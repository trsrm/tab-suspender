import type { TabActivity } from "../types.js";
import { loadActivityFromStorage, saveActivityToStorage } from "../activity-store.js";

const WINDOW_ID_NONE = -1;

export type QueryTab = {
  id?: number;
  windowId?: number;
  active?: boolean;
  pinned?: boolean;
  audible?: boolean;
  url?: string;
  title?: string;
};

type ActivityRuntimeOptions = {
  queryTabs: (queryInfo: Record<string, unknown>) => Promise<QueryTab[]>;
  getCurrentEpochMinute: () => number;
  log: (message: string, details?: unknown) => void;
};

export function isValidId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function cloneActivity(activity: TabActivity): TabActivity {
  return {
    tabId: activity.tabId,
    windowId: activity.windowId,
    lastActiveAtMinute: activity.lastActiveAtMinute,
    lastUpdatedAtMinute: activity.lastUpdatedAtMinute
  };
}

export type ActivityRuntime = ReturnType<typeof createActivityRuntime>;

export function createActivityRuntime(options: ActivityRuntimeOptions) {
  const activityByTabId = new Map<number, TabActivity>();
  const activeTabIdByWindowId = new Map<number, number>();

  function snapshotActivityState(): TabActivity[] {
    return Array.from(activityByTabId.values())
      .map(cloneActivity)
      .sort((a, b) => a.tabId - b.tabId);
  }

  async function persistActivitySnapshot(): Promise<void> {
    await saveActivityToStorage(snapshotActivityState());
  }

  async function hydrateFromStorage(): Promise<void> {
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
      options.log("Failed to load activity state from storage. Falling back to empty state.", error);
    }
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

  function markTabActive(tabId: number, windowId: number | undefined, minute = options.getCurrentEpochMinute()): boolean {
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

  function markTabUpdated(tabId: number, windowId: number | undefined, minute = options.getCurrentEpochMinute()): boolean {
    if (!isValidId(tabId)) {
      return false;
    }

    const existing = activityByTabId.get(tabId);
    const record = upsertActivity(tabId, windowId, minute);
    const changed =
      !existing || record.lastUpdatedAtMinute !== minute || (isValidId(windowId) && record.windowId !== windowId);

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

  async function pruneStaleActivityEntries(): Promise<boolean> {
    try {
      const tabs = await options.queryTabs({});
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
      options.log("Failed to prune stale activity entries.", error);
      return false;
    }
  }

  async function seedActiveTabsOnStartup(): Promise<boolean> {
    try {
      const tabs = await options.queryTabs({ active: true });
      const minute = options.getCurrentEpochMinute();
      let changed = false;

      for (const tab of tabs) {
        if (!isValidId(tab.id)) {
          continue;
        }

        if (markTabActive(tab.id, tab.windowId, minute)) {
          changed = true;
        }

        if (isValidId(tab.windowId) && activeTabIdByWindowId.get(tab.windowId) !== tab.id) {
          activeTabIdByWindowId.set(tab.windowId, tab.id);
          changed = true;
        }
      }

      return changed;
    } catch (error) {
      options.log("Failed to seed active tab activity state.", error);
      return false;
    }
  }

  function getActiveTabByWindowSnapshot(): Array<{ windowId: number; tabId: number }> {
    return Array.from(activeTabIdByWindowId.entries())
      .map(([windowId, tabId]) => ({ windowId, tabId }))
      .sort((a, b) => a.windowId - b.windowId);
  }

  function resetActivityState(): void {
    activityByTabId.clear();
    activeTabIdByWindowId.clear();
  }

  return {
    hydrateFromStorage,
    persistActivitySnapshot,
    snapshotActivityState,
    getActiveTabByWindowSnapshot,
    resetActivityState,
    markTabActive,
    markTabUpdated,
    markWindowActiveTabInactive,
    ensureTabActivityBaseline,
    getWindowIdForActiveTab,
    clearActiveWindowMappingForTab,
    pruneStaleActivityEntries,
    seedActiveTabsOnStartup,
    getActivityForTab(tabId: number): TabActivity | undefined {
      return activityByTabId.get(tabId);
    },
    setActiveTabForWindow(windowId: number, tabId: number): void {
      activeTabIdByWindowId.set(windowId, tabId);
    },
    deleteActivityForTab(tabId: number): boolean {
      return activityByTabId.delete(tabId);
    },
    replaceActivityRecord(tabId: number, record: TabActivity): void {
      activityByTabId.set(tabId, record);
    }
  };
}
