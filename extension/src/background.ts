import {
  isSuspendDiagnosticsRequest,
  isStorageChange,
  isMeaningfulTabUpdatedChangeInfo,
  isStorageOnChangedMap,
  type DecodedSuspendPayload,
  type CompiledPolicyContext,
  type RecoveryEntry,
  type Settings,
  type SweepRunStats,
  type SuspendDiagnosticsResponse,
  type StorageChange,
  type SuspendPayload,
  type TabActivity
} from "./types.js";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, decodeStoredSettings, loadSettingsFromStorage } from "./settings-store.js";
import { loadRecoveryFromStorage, saveRecoveryToStorage } from "./recovery-store.js";
import { isSuspendedDataUrl as isGeneratedSuspendedDataUrl } from "./suspended-payload.js";
import { compilePolicyContext } from "./matcher.js";
import { createPersistQueue } from "./background/persist-queue.js";
import type { PersistErrorContext } from "./background/persist-queue.js";
import { createSweepCoordinator } from "./background/sweep-coordinator.js";
import { initializeRuntimeState as bootstrapRuntimeState } from "./background/runtime-bootstrap.js";
import { createActivityRuntime, isValidId } from "./background/activity-runtime.js";
import type { QueryTab } from "./background/activity-runtime.js";
import { createSuspendRunner, computeSweepIntervalMinutes, decodeSuspendedTabPayload, encodeSuspendedUrl } from "./background/suspend-runner.js";

const LOG_PREFIX = "[tab-suspender]";
const MINUTE_MS = 60_000;
const SUSPEND_SWEEP_ALARM = "suspend-sweep-v1";
const SUSPEND_SWEEP_PERIOD_MINUTES = 1;
const MAX_SWEEP_BACKOFF_MINUTES = 5;
const HEAVY_SWEEP_EVALUATED_TABS_THRESHOLD = 400;
const HEAVY_SWEEP_DURATION_MS_THRESHOLD = 750;
const HEAVY_SWEEP_FAILED_UPDATES_THRESHOLD = 5;
const LIGHT_SWEEP_EVALUATED_TABS_THRESHOLD = 150;
const LIGHT_SWEEP_DURATION_MS_THRESHOLD = 250;

type ActivatedInfo = {
  tabId: number;
  windowId: number;
};

type AlarmInfo = {
  name?: string;
};

type BackgroundRuntimeState = {
  recoveryEntries: RecoveryEntry[];
  focusedWindowId: number | null;
  currentSettings: Settings;
  compiledPolicyContext: CompiledPolicyContext;
  settingsTransitionEpoch: number;
  sweepBackoffMinutes: number;
  lastSweepStats: SweepRunStats | null;
  runtimeReady: Promise<void>;
};

type BackgroundTestingApi = {
  getActivitySnapshot: () => TabActivity[];
  resetActivityState: () => void;
  runSuspendSweep: (nowMinute?: number) => Promise<void>;
  waitForRuntimeReady: () => Promise<void>;
  flushPersistedActivityWrites: () => Promise<void>;
  flushPersistedRecoveryWrites: () => Promise<void>;
  getCurrentSettings: () => Settings;
  buildSuspendedUrl: (payload: SuspendPayload) => string;
  decodeSuspendedUrl: (url: string) => DecodedSuspendPayload | null;
  isSuspendedDataUrl: (url: string | undefined) => boolean;
  getSweepBackoffMinutes: () => number;
  getLastSweepStats: () => SweepRunStats | null;
};

function createInitialRuntimeState(): BackgroundRuntimeState {
  const initialSettings = cloneSettings(DEFAULT_SETTINGS);

  return {
    recoveryEntries: [],
    focusedWindowId: null,
    currentSettings: initialSettings,
    compiledPolicyContext: compilePolicyContext(initialSettings),
    settingsTransitionEpoch: 0,
    sweepBackoffMinutes: 0,
    lastSweepStats: null,
    runtimeReady: Promise.resolve()
  };
}

const runtimeState = createInitialRuntimeState();

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

function cloneSettings(settings: Settings): Settings {
  return {
    idleMinutes: settings.idleMinutes,
    excludedHosts: [...settings.excludedHosts],
    skipPinned: settings.skipPinned,
    skipAudible: settings.skipAudible,
    siteProfiles: settings.siteProfiles.map((profile) => ({
      id: profile.id,
      hostRule: profile.hostRule,
      overrides: {
        ...profile.overrides
      }
    }))
  };
}

function clampSweepBackoffMinutes(value: number): number {
  return Math.min(MAX_SWEEP_BACKOFF_MINUTES, Math.max(0, Math.floor(value)));
}

function getEffectiveSweepIntervalMinutes(settings: Settings, sweepBackoffMinutes: number): number {
  const baseInterval = computeSweepIntervalMinutes(settings);
  return Math.min(30, baseInterval + clampSweepBackoffMinutes(sweepBackoffMinutes));
}

function computeNextSweepBackoffMinutes(currentBackoffMinutes: number, stats: SweepRunStats): number {
  const isHeavySweep =
    stats.evaluatedTabs >= HEAVY_SWEEP_EVALUATED_TABS_THRESHOLD ||
    stats.durationMs >= HEAVY_SWEEP_DURATION_MS_THRESHOLD ||
    stats.failedUpdates >= HEAVY_SWEEP_FAILED_UPDATES_THRESHOLD;

  if (isHeavySweep) {
    return clampSweepBackoffMinutes(currentBackoffMinutes + 1);
  }

  const isLightSweep =
    stats.evaluatedTabs < LIGHT_SWEEP_EVALUATED_TABS_THRESHOLD &&
    stats.durationMs < LIGHT_SWEEP_DURATION_MS_THRESHOLD &&
    stats.failedUpdates === 0;

  if (isLightSweep) {
    return clampSweepBackoffMinutes(currentBackoffMinutes - 1);
  }

  return currentBackoffMinutes;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function queryTabs(queryInfo: Record<string, unknown>): Promise<QueryTab[]> {
  const tabsApi = chrome.tabs;

  return new Promise<QueryTab[]>((resolve, reject) => {
    let settled = false;

    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(normalizeError(error));
    };

    const resolveOnce = (tabs: QueryTab[] | undefined): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(Array.isArray(tabs) ? tabs : []);
    };

    const callback = (tabs: QueryTab[] | undefined): void => {
      if (settled) {
        return;
      }

      const lastError = chrome.runtime.lastError;

      if (lastError) {
        rejectOnce(new Error(lastError.message));
        return;
      }

      resolveOnce(tabs);
    };

    try {
      const maybePromise = tabsApi.query(
        queryInfo as Parameters<typeof tabsApi.query>[0],
        callback as Parameters<typeof tabsApi.query>[1]
      ) as Promise<QueryTab[]> | void;

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolveOnce).catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
}

function updateTab(tabId: number, updateProperties: Record<string, unknown>): Promise<void> {
  const tabsApi = chrome.tabs;

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(normalizeError(error));
    };

    const resolveOnce = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    const callback = (): void => {
      if (settled) {
        return;
      }

      const lastError = chrome.runtime.lastError;

      if (lastError) {
        rejectOnce(new Error(lastError.message));
        return;
      }

      resolveOnce();
    };

    try {
      const maybePromise = tabsApi.update(
        tabId as Parameters<typeof tabsApi.update>[0],
        updateProperties as Parameters<typeof tabsApi.update>[1],
        callback as Parameters<typeof tabsApi.update>[2]
      ) as Promise<unknown> | void;

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(() => resolveOnce()).catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
}

const activityRuntime = createActivityRuntime({
  queryTabs,
  getCurrentEpochMinute,
  log
});

function snapshotRecoveryState(): RecoveryEntry[] {
  return runtimeState.recoveryEntries.map((entry) => ({
    url: entry.url,
    title: entry.title,
    suspendedAtMinute: entry.suspendedAtMinute
  }));
}

async function persistRecoverySnapshot(): Promise<void> {
  const persisted = await saveRecoveryToStorage(snapshotRecoveryState());
  runtimeState.recoveryEntries = persisted.entries;
}

const activityPersistQueue = createPersistQueue({
  persist: () => activityRuntime.persistActivitySnapshot(),
  onPersistError: (error, context) => {
    logPersistFailure("activity", error, context);
  }
});

const recoveryPersistQueue = createPersistQueue({
  persist: persistRecoverySnapshot,
  onPersistError: (error, context) => {
    logPersistFailure("recovery", error, context);
  }
});

function schedulePersistActivity(): void {
  activityPersistQueue.markDirty();
}

function schedulePersistRecovery(): void {
  recoveryPersistQueue.markDirty();
}

function logPersistFailure(target: "activity" | "recovery", error: unknown, context: PersistErrorContext): void {
  log(`Failed to persist ${target} snapshot.`, {
    error,
    attempt: context.attempt,
    willRetry: context.willRetry,
    terminal: context.terminal
  });
}

function beginSettingsTransition(): number {
  runtimeState.settingsTransitionEpoch += 1;
  return runtimeState.settingsTransitionEpoch;
}

function tryCommitSettingsTransition(epoch: number, settings: Settings): boolean {
  if (epoch !== runtimeState.settingsTransitionEpoch) {
    return false;
  }

  runtimeState.currentSettings = cloneSettings(settings);
  runtimeState.compiledPolicyContext = compilePolicyContext(runtimeState.currentSettings);
  return true;
}

function applyStoredSettingsValue(value: unknown): void {
  const epoch = beginSettingsTransition();
  const nextSettings = decodeStoredSettings(value);

  if (!tryCommitSettingsTransition(epoch, nextSettings)) {
    return;
  }

  alignSweepCadenceAfterSettingsChange();
}

async function hydrateSettingsFromStorage(): Promise<void> {
  const epoch = beginSettingsTransition();

  try {
    const hydrated = await loadSettingsFromStorage();

    if (tryCommitSettingsTransition(epoch, hydrated)) {
      alignSweepCadenceAfterSettingsChange();
    }
  } catch (error) {
    const fallback = cloneSettings(DEFAULT_SETTINGS);

    if (tryCommitSettingsTransition(epoch, fallback)) {
      alignSweepCadenceAfterSettingsChange();
    }

    log("Failed to load settings from storage. Falling back to defaults.", error);
  }
}

async function hydrateRecoveryFromStorage(): Promise<void> {
  try {
    runtimeState.recoveryEntries = await loadRecoveryFromStorage();
  } catch (error) {
    runtimeState.recoveryEntries = [];
    log("Failed to load recovery state from storage. Falling back to empty state.", error);
  }
}

const suspendRunner = createSuspendRunner({
  queryTabs,
  updateTab,
  waitForRuntimeReady: () => runtimeState.runtimeReady,
  getCurrentEpochMinute,
  getCurrentSettings: () => runtimeState.currentSettings,
  getCompiledPolicyContext: () => runtimeState.compiledPolicyContext,
  getActivityForTab: (tabId) => activityRuntime.getActivityForTab(tabId),
  ensureTabActivityBaseline: (tab, nowMinute) => activityRuntime.ensureTabActivityBaseline(tab, nowMinute),
  markTabUpdated: (tabId, windowId, minute) => activityRuntime.markTabUpdated(tabId, windowId, minute),
  schedulePersistActivity,
  appendRecoveryEntry: (entry) => {
    runtimeState.recoveryEntries = suspendRunner.appendRecoveryEntryWithCap(entry, runtimeState.recoveryEntries);
  },
  schedulePersistRecovery,
  log
});

const sweepCoordinator = createSweepCoordinator({
  runSweep: async (minute) => {
    const stats = await suspendRunner.runSuspendSweep(minute);
    applySweepBackoffFromStats(stats, minute);
  },
  onSweepError: (error) => {
    log("Suspend sweep run failed.", error);
  }
});

function alignSweepCadenceAfterSettingsChange(nowMinute = getCurrentEpochMinute()): void {
  const interval = getEffectiveSweepIntervalMinutes(runtimeState.currentSettings, runtimeState.sweepBackoffMinutes);
  sweepCoordinator.alignDueCandidate(nowMinute, nowMinute + interval);
}

function applySweepBackoffFromStats(stats: SweepRunStats, nowMinute: number): void {
  runtimeState.lastSweepStats = {
    evaluatedTabs: stats.evaluatedTabs,
    suspendedTabs: stats.suspendedTabs,
    failedUpdates: stats.failedUpdates,
    durationMs: stats.durationMs
  };

  const nextBackoffMinutes = computeNextSweepBackoffMinutes(runtimeState.sweepBackoffMinutes, stats);

  if (nextBackoffMinutes === runtimeState.sweepBackoffMinutes) {
    return;
  }

  runtimeState.sweepBackoffMinutes = nextBackoffMinutes;
  sweepCoordinator.setDueMinute(
    nowMinute + getEffectiveSweepIntervalMinutes(runtimeState.currentSettings, runtimeState.sweepBackoffMinutes)
  );
}

function handleStorageSettingsChange(changes: unknown, areaName: string): void {
  if (areaName !== "local" || !isStorageOnChangedMap(changes)) {
    return;
  }

  const settingsChange = changes[SETTINGS_STORAGE_KEY];
  if (!isStorageChange(settingsChange)) {
    return;
  }

  applyStoredSettingsValue(settingsChange.newValue);
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

runtimeState.runtimeReady = (async () => {
  const settingsReady = hydrateSettingsFromStorage();
  const activityReady = activityRuntime.hydrateFromStorage();

  await bootstrapRuntimeState({
    hydrateSettings: () => settingsReady,
    hydrateActivity: () => activityReady,
    hydrateRecovery: hydrateRecoveryFromStorage,
    pruneStaleActivityEntries: () => activityRuntime.pruneStaleActivityEntries(),
    seedActiveTabsOnStartup: () => activityRuntime.seedActiveTabsOnStartup(),
    schedulePersistActivity,
    setInitialSweepDueMinute: (minute) => {
      sweepCoordinator.setDueMinute(minute);
    },
    getCurrentEpochMinute
  });
})();

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
    activityRuntime.markWindowActiveTabInactive(activeInfo.windowId, minute);
  }

  activityRuntime.markTabActive(activeInfo.tabId, activeInfo.windowId, minute);

  if (isValidId(activeInfo.windowId)) {
    activityRuntime.setActiveTabForWindow(activeInfo.windowId, activeInfo.tabId);
    runtimeState.focusedWindowId = activeInfo.windowId;
  }

  schedulePersistActivity();
});

chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: unknown, tab: QueryTab | undefined) => {
  if (!tab || tab.active !== true || !isMeaningfulTabUpdatedChangeInfo(changeInfo)) {
    return;
  }

  const minute = getCurrentEpochMinute();

  if (activityRuntime.markTabActive(tabId, tab.windowId, minute)) {
    if (isValidId(tab.windowId)) {
      activityRuntime.setActiveTabForWindow(tab.windowId, tabId);
      runtimeState.focusedWindowId = tab.windowId;
    }

    schedulePersistActivity();
  }
});

chrome.windows.onFocusChanged.addListener((windowId: number) => {
  const minute = getCurrentEpochMinute();

  if (!isValidId(windowId) || windowId === chrome.windows.WINDOW_ID_NONE) {
    if (isValidId(runtimeState.focusedWindowId) && activityRuntime.markWindowActiveTabInactive(runtimeState.focusedWindowId, minute)) {
      schedulePersistActivity();
    }

    runtimeState.focusedWindowId = null;
    return;
  }

  if (
    isValidId(runtimeState.focusedWindowId) &&
    runtimeState.focusedWindowId !== windowId &&
    activityRuntime.markWindowActiveTabInactive(runtimeState.focusedWindowId, minute)
  ) {
    schedulePersistActivity();
  }

  runtimeState.focusedWindowId = windowId;

  void queryTabs({ active: true, windowId })
    .then((tabs) => {
      const firstActiveTab = tabs[0];

      if (!firstActiveTab || !isValidId(firstActiveTab.id)) {
        return;
      }

      if (activityRuntime.markTabActive(firstActiveTab.id, firstActiveTab.windowId ?? windowId, minute)) {
        schedulePersistActivity();
      }

      activityRuntime.setActiveTabForWindow(windowId, firstActiveTab.id);
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

  if (activityRuntime.deleteActivityForTab(tabId)) {
    changed = true;
  }

  if (activityRuntime.clearActiveWindowMappingForTab(tabId)) {
    changed = true;
  }

  if (changed) {
    schedulePersistActivity();
  }
});

chrome.tabs.onReplaced.addListener((addedTabId: number, removedTabId: number) => {
  const minute = getCurrentEpochMinute();
  const previous = isValidId(removedTabId) ? activityRuntime.getActivityForTab(removedTabId) : undefined;
  const previousWindowId = isValidId(removedTabId) ? activityRuntime.getWindowIdForActiveTab(removedTabId) : null;

  let changed = false;

  if (isValidId(removedTabId)) {
    if (activityRuntime.deleteActivityForTab(removedTabId)) {
      changed = true;
    }

    if (activityRuntime.clearActiveWindowMappingForTab(removedTabId)) {
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

    activityRuntime.replaceActivityRecord(addedTabId, {
      ...previous,
      tabId: addedTabId,
      windowId: nextWindowId,
      lastActiveAtMinute: minute,
      lastUpdatedAtMinute: minute
    });

    if (isValidId(nextWindowId)) {
      activityRuntime.setActiveTabForWindow(nextWindowId, addedTabId);
    }

    changed = true;
  } else {
    changed = activityRuntime.markTabUpdated(addedTabId, undefined, minute) || changed;

    if (isValidId(previousWindowId)) {
      activityRuntime.setActiveTabForWindow(previousWindowId, addedTabId);
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

  const nowMinute = getCurrentEpochMinute();

  if (!sweepCoordinator.shouldRun(nowMinute)) {
    return;
  }

  sweepCoordinator.markRan(
    nowMinute,
    getEffectiveSweepIntervalMinutes(runtimeState.currentSettings, runtimeState.sweepBackoffMinutes)
  );
  void sweepCoordinator.requestSweep(nowMinute);
});

chrome.action.onClicked.addListener((tab: QueryTab | undefined) => {
  void suspendRunner.suspendFromAction(tab);
});

if (chrome.storage?.onChanged && typeof chrome.storage.onChanged.addListener === "function") {
  chrome.storage.onChanged.addListener(
    (changes: unknown, areaName: string | undefined) => {
      handleStorageSettingsChange(changes, areaName ?? "");
    }
  );
}

if (chrome.runtime?.onMessage && typeof chrome.runtime.onMessage.addListener === "function") {
  chrome.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response: SuspendDiagnosticsResponse) => void) => {
    if (!isSuspendDiagnosticsRequest(message)) {
      return undefined;
    }

    void runtimeState.runtimeReady
      .then(() => suspendRunner.getSuspendDiagnosticsSnapshot())
      .then((response) => {
        sendResponse(response);
      })
      .catch((error: unknown) => {
        log("Failed to generate suspend diagnostics snapshot.", error);
        sendResponse({
          ok: false,
          message: "Failed to generate suspend diagnostics snapshot."
        });
      });

    return true;
  });
}

scheduleSuspendSweepAlarm();

export const __testing: BackgroundTestingApi = {
  getActivitySnapshot(): TabActivity[] {
    return activityRuntime.snapshotActivityState();
  },
  resetActivityState(): void {
    activityRuntime.resetActivityState();
    runtimeState.focusedWindowId = null;
  },
  runSuspendSweep(nowMinute?: number): Promise<void> {
    return suspendRunner.runSuspendSweep(nowMinute).then(() => undefined);
  },
  waitForRuntimeReady(): Promise<void> {
    return runtimeState.runtimeReady;
  },
  flushPersistedActivityWrites(): Promise<void> {
    return activityPersistQueue.waitForIdle();
  },
  flushPersistedRecoveryWrites(): Promise<void> {
    return recoveryPersistQueue.waitForIdle();
  },
  getCurrentSettings(): Settings {
    return cloneSettings(runtimeState.currentSettings);
  },
  buildSuspendedUrl(payload: SuspendPayload): string {
    return encodeSuspendedUrl(payload);
  },
  decodeSuspendedUrl(url: string): DecodedSuspendPayload | null {
    return decodeSuspendedTabPayload(url);
  },
  isSuspendedDataUrl(url: string | undefined): boolean {
    return isGeneratedSuspendedDataUrl(url);
  },
  getSweepBackoffMinutes(): number {
    return runtimeState.sweepBackoffMinutes;
  },
  getLastSweepStats(): SweepRunStats | null {
    if (!runtimeState.lastSweepStats) {
      return null;
    }

    return {
      evaluatedTabs: runtimeState.lastSweepStats.evaluatedTabs,
      suspendedTabs: runtimeState.lastSweepStats.suspendedTabs,
      failedUpdates: runtimeState.lastSweepStats.failedUpdates,
      durationMs: runtimeState.lastSweepStats.durationMs
    };
  }
};
