import { evaluateSuspendDecision } from "./policy.js";
import type { PolicyEvaluatorInput, Settings, SuspendPayload, TabActivity } from "./types.js";
import { validateRestorableUrl } from "./url-safety.js";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, decodeStoredSettings, loadSettingsFromStorage } from "./settings-store.js";
import { isExcludedUrlByHost } from "./matcher.js";

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

type SuspendEvaluationOptions = {
  ignoreActive?: boolean;
  forceTimeoutReached?: boolean;
};

const activityByTabId = new Map<number, TabActivity>();
let currentSettings: Settings = {
  idleMinutes: DEFAULT_SETTINGS.idleMinutes,
  excludedHosts: [...DEFAULT_SETTINGS.excludedHosts],
  skipPinned: DEFAULT_SETTINGS.skipPinned,
  skipAudible: DEFAULT_SETTINGS.skipAudible
};
let settingsReady: Promise<void> = Promise.resolve();

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

function markTabActive(tabId: number, windowId: number | undefined, minute = getCurrentEpochMinute()): void {
  if (!isValidId(tabId)) {
    return;
  }

  const record = upsertActivity(tabId, windowId, minute);
  record.lastActiveAtMinute = minute;
  record.lastUpdatedAtMinute = minute;
}

function markTabUpdated(tabId: number, windowId: number | undefined, minute = getCurrentEpochMinute()): void {
  if (!isValidId(tabId)) {
    return;
  }

  const record = upsertActivity(tabId, windowId, minute);
  record.lastUpdatedAtMinute = minute;
}

async function queryTabs(queryInfo: Record<string, unknown>): Promise<QueryTab[]> {
  const tabsApi = chrome.tabs;

  return new Promise<QueryTab[]>((resolve, reject) => {
    let settled = false;

    const callback = (tabs: QueryTab[] | undefined): void => {
      if (settled) {
        return;
      }

      settled = true;
      const lastError = chrome.runtime.lastError;

      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      resolve(Array.isArray(tabs) ? tabs : []);
    };

    try {
      const maybePromise = tabsApi.query(
        queryInfo as Parameters<typeof tabsApi.query>[0],
        callback as Parameters<typeof tabsApi.query>[1]
      ) as Promise<QueryTab[]> | void;

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((tabs) => {
            if (settled) {
              return;
            }

            settled = true;
            resolve(Array.isArray(tabs) ? tabs : []);
          })
          .catch((error: unknown) => {
            if (settled) {
              return;
            }

            settled = true;
            reject(error instanceof Error ? error : new Error(String(error)));
          });
      }
    } catch (error) {
      if (settled) {
        return;
      }

      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

async function updateTab(tabId: number, updateProperties: Record<string, unknown>): Promise<void> {
  const tabsApi = chrome.tabs;

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const callback = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      const lastError = chrome.runtime.lastError;

      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      resolve();
    };

    try {
      const maybePromise = tabsApi.update(
        tabId as Parameters<typeof tabsApi.update>[0],
        updateProperties as Parameters<typeof tabsApi.update>[1],
        callback as Parameters<typeof tabsApi.update>[2]
      ) as Promise<unknown> | void;

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then(() => {
            if (settled) {
              return;
            }

            settled = true;
            resolve();
          })
          .catch((error: unknown) => {
            if (settled) {
              return;
            }

            settled = true;
            reject(error instanceof Error ? error : new Error(String(error)));
          });
      }
    } catch (error) {
      if (settled) {
        return;
      }

      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
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
  } catch (error) {
    log("Failed to suspend tab.", {
      tabId: tab.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function runSuspendSweep(nowMinute = getCurrentEpochMinute()): Promise<void> {
  await settingsReady;

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
  await settingsReady;

  if (!tab) {
    return;
  }

  await suspendTabIfEligible(tab, nowMinute, {
    ignoreActive: true,
    forceTimeoutReached: true
  });
}

function scheduleSuspendSweepAlarm(): void {
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

async function seedActiveTabsOnStartup(): Promise<void> {
  try {
    const tabs = await queryTabs({ active: true });
    const minute = getCurrentEpochMinute();

    for (const tab of tabs) {
      markTabActive(tab.id ?? WINDOW_ID_NONE, tab.windowId, minute);
    }
  } catch (error) {
    log("Failed to seed active tab activity state.", error);
  }
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
  markTabActive(activeInfo.tabId, activeInfo.windowId);
});

chrome.tabs.onUpdated.addListener((tabId: number, _changeInfo: unknown, tab: QueryTab | undefined) => {
  markTabUpdated(tabId, tab?.windowId);
});

chrome.windows.onFocusChanged.addListener((windowId: number) => {
  if (!isValidId(windowId) || windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  void queryTabs({ active: true, windowId })
    .then((tabs) => {
      const firstActiveTab = tabs[0];

      if (!firstActiveTab) {
        return;
      }

      markTabActive(firstActiveTab.id ?? WINDOW_ID_NONE, firstActiveTab.windowId ?? windowId);
    })
    .catch((error: unknown) => {
      log("Failed to resolve active tab on window focus.", error);
    });
});

chrome.tabs.onRemoved.addListener((tabId: number) => {
  if (!isValidId(tabId)) {
    return;
  }

  activityByTabId.delete(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId: number, removedTabId: number) => {
  const minute = getCurrentEpochMinute();
  const previous = isValidId(removedTabId) ? activityByTabId.get(removedTabId) : undefined;

  if (isValidId(removedTabId)) {
    activityByTabId.delete(removedTabId);
  }

  if (!isValidId(addedTabId)) {
    return;
  }

  if (previous) {
    activityByTabId.set(addedTabId, {
      ...previous,
      tabId: addedTabId,
      lastActiveAtMinute: minute,
      lastUpdatedAtMinute: minute
    });
    return;
  }

  markTabUpdated(addedTabId, undefined, minute);
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

settingsReady = hydrateSettingsFromStorage();
scheduleSuspendSweepAlarm();
void seedActiveTabsOnStartup();

export const __testing = {
  getActivitySnapshot(): TabActivity[] {
    return Array.from(activityByTabId.values())
      .map((record) => ({ ...record }))
      .sort((a, b) => a.tabId - b.tabId);
  },
  resetActivityState(): void {
    activityByTabId.clear();
  },
  runSuspendSweep(nowMinute?: number): Promise<void> {
    return runSuspendSweep(nowMinute);
  },
  waitForSettingsHydration(): Promise<void> {
    return settingsReady;
  },
  getCurrentSettings(): Settings {
    return cloneSettings(currentSettings);
  },
  buildSuspendedUrl(payload: SuspendPayload): string {
    return encodeSuspendedUrl(payload);
  }
};
