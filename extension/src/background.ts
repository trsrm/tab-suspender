import { evaluateSuspendDecision } from "./policy.js";
import type { PolicyEvaluatorInput, Settings, SuspendPayload, TabActivity } from "./types.js";
import { validateRestorableUrl } from "./url-safety.js";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, decodeStoredSettings, loadSettingsFromStorage } from "./settings-store.js";
import { isExcludedUrlByHost } from "./matcher.js";
import { loadActivityFromStorage, saveActivityToStorage } from "./activity-store.js";

const LOG_PREFIX = "[tab-suspender]";
const MINUTE_MS = 60_000;
const WINDOW_ID_NONE = -1;
const MAX_SUSPENDED_TITLE_LENGTH = 120;
const SUSPEND_SWEEP_ALARM = "suspend-sweep-v1";
const SUSPEND_SWEEP_PERIOD_MINUTES = 1;

type QueryTab = {
  id?: number;
  windowId?: number;
  active?: boolean;
  pinned?: boolean;
  audible?: boolean;
  url?: string;
  title?: string;
};

type ActivatedInfo = {
  tabId: number;
  windowId: number;
};

type AlarmInfo = {
  name?: string;
};

type StorageChange = {
  newValue?: unknown;
  oldValue?: unknown;
};

type TabUpdatedChangeInfo = {
  status?: string;
  url?: string;
};

type SuspendEvaluationOptions = {
  ignoreActive?: boolean;
  forceTimeoutReached?: boolean;
};

const activityByTabId = new Map<number, TabActivity>();
const activeTabIdByWindowId = new Map<number, number>();
let focusedWindowId: number | null = null;
let currentSettings: Settings = {
  idleMinutes: DEFAULT_SETTINGS.idleMinutes,
  excludedHosts: [...DEFAULT_SETTINGS.excludedHosts],
  skipPinned: DEFAULT_SETTINGS.skipPinned,
  skipAudible: DEFAULT_SETTINGS.skipAudible
};
// Suspension paths wait on this gate so sweeps and action-click use hydrated settings/activity state.
let settingsReady: Promise<void> = Promise.resolve();
let activityReady: Promise<void> = Promise.resolve();
let runtimeReady: Promise<void> = Promise.resolve();
let activityPersistQueue: Promise<void> = Promise.resolve();

function log(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, details);
}

function getCurrentEpochMinute(): number {
  return Math.floor(Date.now() / MINUTE_MS);
}

function isValidId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function cloneSettings(settings: Settings): Settings {
  return {
    idleMinutes: settings.idleMinutes,
    excludedHosts: [...settings.excludedHosts],
    skipPinned: settings.skipPinned,
    skipAudible: settings.skipAudible
  };
}

function cloneActivity(activity: TabActivity): TabActivity {
  return {
    tabId: activity.tabId,
    windowId: activity.windowId,
    lastActiveAtMinute: activity.lastActiveAtMinute,
    lastUpdatedAtMinute: activity.lastUpdatedAtMinute
  };
}

function snapshotActivityState(): TabActivity[] {
  return Array.from(activityByTabId.values())
    .map(cloneActivity)
    .sort((a, b) => a.tabId - b.tabId);
}

async function persistActivitySnapshot(): Promise<void> {
  await saveActivityToStorage(snapshotActivityState());
}

function schedulePersistActivity(): void {
  activityPersistQueue = activityPersistQueue
    .then(() => persistActivitySnapshot())
    .catch((error: unknown) => {
      log("Failed to persist activity snapshot.", error);
    });
}

function applyStoredSettingsValue(value: unknown): void {
  currentSettings = decodeStoredSettings(value);
}

async function hydrateSettingsFromStorage(): Promise<void> {
  try {
    currentSettings = await loadSettingsFromStorage();
  } catch (error) {
    currentSettings = cloneSettings(DEFAULT_SETTINGS);
    log("Failed to load settings from storage. Falling back to defaults.", error);
  }
}

async function hydrateActivityFromStorage(): Promise<void> {
  try {
    const storedActivity = await loadActivityFromStorage();
    activityByTabId.clear();

    for (const record of storedActivity) {
      activityByTabId.set(record.tabId, {
        tabId: record.tabId,
        windowId: record.windowId,
        lastActiveAtMinute: record.lastActiveAtMinute,
        lastUpdatedAtMinute: record.lastUpdatedAtMinute
      });
    }
  } catch (error) {
    activityByTabId.clear();
    log("Failed to load activity state from storage. Falling back to empty state.", error);
  }
}

function handleStorageSettingsChange(changes: Record<string, StorageChange> | undefined, areaName: string): void {
  if (areaName !== "local" || !changes) {
    return;
  }

  const settingsChange = changes[SETTINGS_STORAGE_KEY];

  if (!settingsChange) {
    return;
  }

  applyStoredSettingsValue(settingsChange.newValue);
}

function upsertActivity(tabId: number, windowId: number | undefined, minute: number): TabActivity {
  const existing = activityByTabId.get(tabId);

  if (existing) {
    if (isValidId(windowId)) {
      existing.windowId = windowId;
    }

    return existing;
  }

  const record: TabActivity = {
    tabId,
    windowId: isValidId(windowId) ? windowId : WINDOW_ID_NONE,
    lastActiveAtMinute: minute,
    lastUpdatedAtMinute: minute
  };

  activityByTabId.set(tabId, record);
  return record;
}

function markTabActive(tabId: number, windowId: number | undefined, minute = getCurrentEpochMinute()): boolean {
  if (!isValidId(tabId)) {
    return false;
  }

  const existing = activityByTabId.get(tabId);
  const record = upsertActivity(tabId, windowId, minute);
  const changed =
    !existing ||
    record.lastActiveAtMinute !== minute ||
    record.lastUpdatedAtMinute !== minute ||
    (isValidId(windowId) && record.windowId !== windowId);

  record.lastActiveAtMinute = minute;
  record.lastUpdatedAtMinute = minute;

  if (isValidId(windowId)) {
    record.windowId = windowId;
  }

  return changed;
}

function markTabUpdated(tabId: number, windowId: number | undefined, minute = getCurrentEpochMinute()): boolean {
  if (!isValidId(tabId)) {
    return false;
  }

  const existing = activityByTabId.get(tabId);
  const record = upsertActivity(tabId, windowId, minute);
  const changed = !existing || record.lastUpdatedAtMinute !== minute || (isValidId(windowId) && record.windowId !== windowId);

  record.lastUpdatedAtMinute = minute;

  if (isValidId(windowId)) {
    record.windowId = windowId;
  }

  return changed;
}

function getWindowIdForActiveTab(tabId: number): number | null {
  for (const [windowId, activeTabId] of activeTabIdByWindowId.entries()) {
    if (activeTabId === tabId) {
      return windowId;
    }
  }

  return null;
}

function clearActiveWindowMappingForTab(tabId: number): boolean {
  let changed = false;

  for (const [windowId, activeTabId] of activeTabIdByWindowId.entries()) {
    if (activeTabId !== tabId) {
      continue;
    }

    activeTabIdByWindowId.delete(windowId);
    changed = true;
  }

  return changed;
}

function markWindowActiveTabInactive(windowId: number, minute: number): boolean {
  const activeTabId = activeTabIdByWindowId.get(windowId);

  if (!isValidId(activeTabId)) {
    return false;
  }

  return markTabUpdated(activeTabId, windowId, minute);
}

function ensureTabActivityBaseline(tab: QueryTab, nowMinute: number): boolean {
  if (!isValidId(tab.id)) {
    return false;
  }

  if (activityByTabId.has(tab.id)) {
    return false;
  }

  return markTabUpdated(tab.id, tab.windowId, nowMinute);
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function invokeChromeApiWithCompatibility<TResult>(
  invoke: (callback: (result: TResult | undefined) => void) => Promise<TResult> | void,
  mapResult: (result: TResult | undefined) => TResult
): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    let settled = false;

    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(normalizeError(error));
    };

    const resolveOnce = (value: TResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    const callback = (result: TResult | undefined): void => {
      if (settled) {
        return;
      }

      const lastError = chrome.runtime.lastError;

      if (lastError) {
        rejectOnce(new Error(lastError.message));
        return;
      }

      resolveOnce(mapResult(result));
    };

    try {
      const maybePromise = invoke(callback);

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then((result) => resolveOnce(mapResult(result))).catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
}

async function queryTabs(queryInfo: Record<string, unknown>): Promise<QueryTab[]> {
  const tabsApi = chrome.tabs;

  return invokeChromeApiWithCompatibility<QueryTab[]>(
    (callback) =>
      tabsApi.query(
        queryInfo as Parameters<typeof tabsApi.query>[0],
        callback as Parameters<typeof tabsApi.query>[1]
      ) as Promise<QueryTab[]> | void,
    (tabs) => (Array.isArray(tabs) ? tabs : [])
  );
}

async function updateTab(tabId: number, updateProperties: Record<string, unknown>): Promise<void> {
  const tabsApi = chrome.tabs;

  return invokeChromeApiWithCompatibility<void>(
    (callback) =>
      tabsApi.update(
        tabId as Parameters<typeof tabsApi.update>[0],
        updateProperties as Parameters<typeof tabsApi.update>[1],
        callback as Parameters<typeof tabsApi.update>[2]
      ) as Promise<void> | void,
    () => undefined
  );
}

function getSyntheticTimedOutActivity(nowMinute: number): Pick<TabActivity, "lastActiveAtMinute" | "lastUpdatedAtMinute"> {
  const eligibleReferenceMinute = Math.max(0, nowMinute - currentSettings.idleMinutes);

  return {
    lastActiveAtMinute: eligibleReferenceMinute,
    lastUpdatedAtMinute: eligibleReferenceMinute
  };
}

function buildPolicyInput(
  tab: QueryTab,
  nowMinute: number,
  options: SuspendEvaluationOptions = {}
): PolicyEvaluatorInput {
  const tabId = isValidId(tab.id) ? tab.id : null;
  const activity = options.forceTimeoutReached
    ? getSyntheticTimedOutActivity(nowMinute)
    : tabId === null
      ? null
      : activityByTabId.get(tabId) ?? null;

  const urlValidation = validateRestorableUrl(tab.url);

  return {
    tab: {
      active: options.ignoreActive ? false : tab.active === true,
      pinned: tab.pinned === true,
      audible: tab.audible === true,
      url: tab.url
    },
    activity,
    settings: currentSettings,
    nowMinute,
    flags: {
      excludedHost: isExcludedUrlByHost(tab.url ?? null, currentSettings.excludedHosts),
      urlTooLong: urlValidation.ok ? false : urlValidation.reason === "tooLong"
    }
  };
}

function sanitizeSuspendedTitle(title: unknown): string {
  if (typeof title !== "string") {
    return "";
  }

  return title.trim().slice(0, MAX_SUSPENDED_TITLE_LENGTH);
}

function buildSuspendPayload(tab: QueryTab, nowMinute: number): SuspendPayload | null {
  const urlValidation = validateRestorableUrl(tab.url);

  if (!urlValidation.ok) {
    return null;
  }

  return {
    u: urlValidation.url,
    t: sanitizeSuspendedTitle(tab.title),
    ts: nowMinute
  };
}

function encodeSuspendedUrl(payload: SuspendPayload): string {
  const params = new URLSearchParams();
  params.set("u", payload.u);
  params.set("t", payload.t);
  params.set("ts", String(payload.ts));

  if (chrome?.runtime && typeof chrome.runtime.getURL === "function") {
    const destinationUrl = new URL(chrome.runtime.getURL("suspended.html"));
    destinationUrl.search = params.toString();
    return destinationUrl.toString();
  }

  return `suspended.html?${params.toString()}`;
}

async function suspendTabIfEligible(
  tab: QueryTab,
  nowMinute: number,
  options: SuspendEvaluationOptions = {}
): Promise<void> {
  if (!isValidId(tab.id)) {
    return;
  }

  if (!options.forceTimeoutReached && ensureTabActivityBaseline(tab, nowMinute)) {
    schedulePersistActivity();
  }

  const decision = evaluateSuspendDecision(buildPolicyInput(tab, nowMinute, options));

  if (!decision.shouldSuspend) {
    return;
  }

  const payload = buildSuspendPayload(tab, nowMinute);

  if (!payload) {
    log("Skipped eligible suspend candidate due missing URL payload.", { tabId: tab.id });
    return;
  }

  try {
    await updateTab(tab.id, { url: encodeSuspendedUrl(payload) });
    markTabUpdated(tab.id, tab.windowId, nowMinute);
    schedulePersistActivity();
  } catch (error) {
    log("Failed to suspend tab.", {
      tabId: tab.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function runSuspendSweep(nowMinute = getCurrentEpochMinute()): Promise<void> {
  // Defer sweeps until settings/activity hydration resolves so policy decisions are deterministic.
  await runtimeReady;

  let tabs: QueryTab[];

  try {
    tabs = await queryTabs({});
  } catch (error) {
    log("Failed to query tabs for suspend sweep.", error);
    return;
  }

  for (const tab of tabs) {
    await suspendTabIfEligible(tab, nowMinute);
  }
}

async function suspendFromAction(tab: QueryTab | undefined, nowMinute = getCurrentEpochMinute()): Promise<void> {
  // Action-click bypasses only active/timeout checks; core safety guards still apply.
  await runtimeReady;

  if (!tab) {
    return;
  }

  await suspendTabIfEligible(tab, nowMinute, {
    ignoreActive: true,
    forceTimeoutReached: true
  });
}

function scheduleSuspendSweepAlarm(): void {
  // Re-register on install/startup to tolerate service-worker restarts.
  const alarmsApi = chrome.alarms;

  if (!alarmsApi || typeof alarmsApi.create !== "function") {
    return;
  }

  try {
    alarmsApi.create(SUSPEND_SWEEP_ALARM, {
      periodInMinutes: SUSPEND_SWEEP_PERIOD_MINUTES
    });
  } catch (error) {
    log("Failed to schedule suspend sweep alarm.", error);
  }
}

async function pruneStaleActivityEntries(): Promise<boolean> {
  try {
    const tabs = await queryTabs({});
    const existingTabIds = new Set<number>();

    for (const tab of tabs) {
      if (isValidId(tab.id)) {
        existingTabIds.add(tab.id);
      }
    }

    let changed = false;

    for (const tabId of activityByTabId.keys()) {
      if (existingTabIds.has(tabId)) {
        continue;
      }

      activityByTabId.delete(tabId);
      changed = true;
    }

    for (const [windowId, tabId] of activeTabIdByWindowId.entries()) {
      if (existingTabIds.has(tabId)) {
        continue;
      }

      activeTabIdByWindowId.delete(windowId);
      changed = true;
    }

    return changed;
  } catch (error) {
    log("Failed to prune stale activity entries.", error);
    return false;
  }
}

async function seedActiveTabsOnStartup(): Promise<boolean> {
  try {
    const tabs = await queryTabs({ active: true });
    const minute = getCurrentEpochMinute();
    let changed = false;

    for (const tab of tabs) {
      if (!isValidId(tab.id)) {
        continue;
      }

      if (markTabActive(tab.id, tab.windowId, minute)) {
        changed = true;
      }

      if (isValidId(tab.windowId)) {
        if (activeTabIdByWindowId.get(tab.windowId) !== tab.id) {
          activeTabIdByWindowId.set(tab.windowId, tab.id);
          changed = true;
        }
      }
    }

    return changed;
  } catch (error) {
    log("Failed to seed active tab activity state.", error);
    return false;
  }
}

async function initializeRuntimeState(): Promise<void> {
  settingsReady = hydrateSettingsFromStorage();
  activityReady = hydrateActivityFromStorage();

  await Promise.all([settingsReady, activityReady]);

  const pruned = await pruneStaleActivityEntries();
  const seeded = await seedActiveTabsOnStartup();

  if (pruned || seeded) {
    schedulePersistActivity();
  }
}

function isMeaningfulTabUpdate(changeInfo: unknown): boolean {
  if (typeof changeInfo !== "object" || changeInfo === null) {
    return false;
  }

  const typed = changeInfo as TabUpdatedChangeInfo;

  return typeof typed.status === "string" || typeof typed.url === "string";
}

chrome.runtime.onInstalled.addListener(() => {
  log("Installed extension with suspend sweep enabled.");
  scheduleSuspendSweepAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  log("Startup detected. Activity listeners and suspend sweep are active.");
  scheduleSuspendSweepAlarm();
});

chrome.tabs.onActivated.addListener((activeInfo: ActivatedInfo) => {
  const minute = getCurrentEpochMinute();

  if (isValidId(activeInfo.windowId)) {
    markWindowActiveTabInactive(activeInfo.windowId, minute);
  }

  markTabActive(activeInfo.tabId, activeInfo.windowId, minute);

  if (isValidId(activeInfo.windowId)) {
    activeTabIdByWindowId.set(activeInfo.windowId, activeInfo.tabId);
    focusedWindowId = activeInfo.windowId;
  }

  schedulePersistActivity();
});

chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: unknown, tab: QueryTab | undefined) => {
  if (!tab || tab.active !== true || !isMeaningfulTabUpdate(changeInfo)) {
    return;
  }

  const minute = getCurrentEpochMinute();

  if (markTabActive(tabId, tab.windowId, minute)) {
    if (isValidId(tab.windowId)) {
      activeTabIdByWindowId.set(tab.windowId, tabId);
      focusedWindowId = tab.windowId;
    }

    schedulePersistActivity();
  }
});

chrome.windows.onFocusChanged.addListener((windowId: number) => {
  const minute = getCurrentEpochMinute();

  if (!isValidId(windowId) || windowId === chrome.windows.WINDOW_ID_NONE) {
    if (isValidId(focusedWindowId) && markWindowActiveTabInactive(focusedWindowId, minute)) {
      schedulePersistActivity();
    }

    focusedWindowId = null;
    return;
  }

  if (isValidId(focusedWindowId) && focusedWindowId !== windowId && markWindowActiveTabInactive(focusedWindowId, minute)) {
    schedulePersistActivity();
  }

  focusedWindowId = windowId;

  void queryTabs({ active: true, windowId })
    .then((tabs) => {
      const firstActiveTab = tabs[0];

      if (!firstActiveTab || !isValidId(firstActiveTab.id)) {
        return;
      }

      if (markTabActive(firstActiveTab.id, firstActiveTab.windowId ?? windowId, minute)) {
        schedulePersistActivity();
      }

      activeTabIdByWindowId.set(windowId, firstActiveTab.id);
    })
    .catch((error: unknown) => {
      log("Failed to resolve active tab on window focus.", error);
    });
});

chrome.tabs.onRemoved.addListener((tabId: number) => {
  if (!isValidId(tabId)) {
    return;
  }

  let changed = false;

  if (activityByTabId.delete(tabId)) {
    changed = true;
  }

  if (clearActiveWindowMappingForTab(tabId)) {
    changed = true;
  }

  if (changed) {
    schedulePersistActivity();
  }
});

chrome.tabs.onReplaced.addListener((addedTabId: number, removedTabId: number) => {
  const minute = getCurrentEpochMinute();
  const previous = isValidId(removedTabId) ? activityByTabId.get(removedTabId) : undefined;
  const previousWindowId = isValidId(removedTabId) ? getWindowIdForActiveTab(removedTabId) : null;

  let changed = false;

  if (isValidId(removedTabId)) {
    if (activityByTabId.delete(removedTabId)) {
      changed = true;
    }

    if (clearActiveWindowMappingForTab(removedTabId)) {
      changed = true;
    }
  }

  if (!isValidId(addedTabId)) {
    if (changed) {
      schedulePersistActivity();
    }

    return;
  }

  if (previous) {
    const nextWindowId = isValidId(previousWindowId) ? previousWindowId : previous.windowId;

    activityByTabId.set(addedTabId, {
      ...previous,
      tabId: addedTabId,
      windowId: nextWindowId,
      lastActiveAtMinute: minute,
      lastUpdatedAtMinute: minute
    });

    if (isValidId(nextWindowId)) {
      activeTabIdByWindowId.set(nextWindowId, addedTabId);
    }

    changed = true;
  } else {
    changed = markTabUpdated(addedTabId, undefined, minute) || changed;

    if (isValidId(previousWindowId)) {
      activeTabIdByWindowId.set(previousWindowId, addedTabId);
      changed = true;
    }
  }

  if (changed) {
    schedulePersistActivity();
  }
});

chrome.alarms.onAlarm.addListener((alarm: AlarmInfo | undefined) => {
  if (alarm?.name !== SUSPEND_SWEEP_ALARM) {
    return;
  }

  void runSuspendSweep();
});

chrome.action.onClicked.addListener((tab: QueryTab | undefined) => {
  void suspendFromAction(tab);
});

if (chrome.storage?.onChanged && typeof chrome.storage.onChanged.addListener === "function") {
  chrome.storage.onChanged.addListener(
    (changes: Record<string, StorageChange> | undefined, areaName: string | undefined) => {
      handleStorageSettingsChange(changes, areaName ?? "");
    }
  );
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: { id?: string } | undefined,
    sendResponse: (response: unknown) => void
  ) => {
    const typedMessage = message as { type?: string } | null | undefined;

    if (typedMessage?.type === "PING") {
      sendResponse({ ok: true, phase: "skeleton" });
      return;
    }

    log("Ignored message in skeleton mode.", { message, sender: sender?.id });
  }
);

runtimeReady = initializeRuntimeState();
scheduleSuspendSweepAlarm();

export const __testing = {
  getActivitySnapshot(): TabActivity[] {
    return snapshotActivityState();
  },
  getActiveTabByWindowSnapshot(): Array<{ windowId: number; tabId: number }> {
    return Array.from(activeTabIdByWindowId.entries())
      .map(([windowId, tabId]) => ({ windowId, tabId }))
      .sort((a, b) => a.windowId - b.windowId);
  },
  resetActivityState(): void {
    activityByTabId.clear();
    activeTabIdByWindowId.clear();
    focusedWindowId = null;
  },
  runSuspendSweep(nowMinute?: number): Promise<void> {
    return runSuspendSweep(nowMinute);
  },
  waitForSettingsHydration(): Promise<void> {
    return settingsReady;
  },
  waitForActivityHydration(): Promise<void> {
    return activityReady;
  },
  waitForRuntimeReady(): Promise<void> {
    return runtimeReady;
  },
  flushPersistedActivityWrites(): Promise<void> {
    return activityPersistQueue;
  },
  getCurrentSettings(): Settings {
    return cloneSettings(currentSettings);
  },
  buildSuspendedUrl(payload: SuspendPayload): string {
    return encodeSuspendedUrl(payload);
  }
};
