import type { TabActivity } from "./types.js";

const LOG_PREFIX = "[tab-suspender]";
const MINUTE_MS = 60_000;
const WINDOW_ID_NONE = -1;

type QueryTab = {
  id?: number;
  windowId?: number;
};
type ActivatedInfo = {
  tabId: number;
  windowId: number;
};

const activityByTabId = new Map<number, TabActivity>();

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
  log("Installed extension with activity tracking enabled.");
});

chrome.runtime.onStartup.addListener(() => {
  log("Startup detected. Activity listeners are active.");
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

void seedActiveTabsOnStartup();

export const __testing = {
  getActivitySnapshot(): TabActivity[] {
    return Array.from(activityByTabId.values())
      .map((record) => ({ ...record }))
      .sort((a, b) => a.tabId - b.tabId);
  },
  resetActivityState(): void {
    activityByTabId.clear();
  }
};
