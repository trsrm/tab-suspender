import type { ActivitySchemaVersion, StoredActivityStateV1, TabActivity } from "./types.js";

export const ACTIVITY_STORAGE_KEY = "activityState";
export const ACTIVITY_SCHEMA_VERSION: ActivitySchemaVersion = 1;
export const MAX_ACTIVITY_RECORDS = 2_000;
const WINDOW_ID_NONE = -1;

type StorageArea = {
  get: (...args: unknown[]) => unknown;
  set: (...args: unknown[]) => unknown;
};

function getRuntimeLastError(): { message?: string } | undefined {
  const runtime = (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome?.runtime;
  return runtime?.lastError;
}

function getStorageArea(storageArea: StorageArea | null | undefined): StorageArea | null {
  if (storageArea && typeof storageArea.get === "function" && typeof storageArea.set === "function") {
    return storageArea;
  }

  const runtimeStorage = (globalThis as { chrome?: { storage?: { local?: StorageArea } } }).chrome?.storage?.local;

  if (runtimeStorage && typeof runtimeStorage.get === "function" && typeof runtimeStorage.set === "function") {
    return runtimeStorage;
  }

  return null;
}

function toNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

function cloneActivityRecord(record: TabActivity): TabActivity {
  return {
    tabId: record.tabId,
    windowId: record.windowId,
    lastActiveAtMinute: record.lastActiveAtMinute,
    lastUpdatedAtMinute: record.lastUpdatedAtMinute
  };
}

function sanitizeActivityRecord(value: unknown): TabActivity | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const tabId = toNonNegativeInteger(source.tabId);
  const lastActiveAtMinute = toNonNegativeInteger(source.lastActiveAtMinute);
  const lastUpdatedAtMinute = toNonNegativeInteger(source.lastUpdatedAtMinute);

  if (tabId === null || lastActiveAtMinute === null || lastUpdatedAtMinute === null) {
    return null;
  }

  const windowIdCandidate = source.windowId;
  const windowId = typeof windowIdCandidate === "number" && Number.isInteger(windowIdCandidate)
    ? windowIdCandidate
    : WINDOW_ID_NONE;
  const normalizedLastUpdatedAtMinute = Math.max(lastUpdatedAtMinute, lastActiveAtMinute);

  return {
    tabId,
    windowId,
    lastActiveAtMinute,
    lastUpdatedAtMinute: normalizedLastUpdatedAtMinute
  };
}

function sanitizeActivity(value: unknown): TabActivity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<number, TabActivity>();

  for (const entry of value) {
    const sanitized = sanitizeActivityRecord(entry);

    if (!sanitized) {
      continue;
    }

    const existing = deduped.get(sanitized.tabId);

    if (
      !existing ||
      sanitized.lastUpdatedAtMinute > existing.lastUpdatedAtMinute ||
      (
        sanitized.lastUpdatedAtMinute === existing.lastUpdatedAtMinute &&
        sanitized.lastActiveAtMinute > existing.lastActiveAtMinute
      )
    ) {
      deduped.set(sanitized.tabId, sanitized);
    }

    if (deduped.size >= MAX_ACTIVITY_RECORDS) {
      break;
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => a.tabId - b.tabId)
    .map(cloneActivityRecord);
}

export function decodeStoredActivityState(value: unknown): TabActivity[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== ACTIVITY_SCHEMA_VERSION) {
    return [];
  }

  return sanitizeActivity(record.activity);
}

function getWithCompatibility(storageArea: StorageArea, key: string): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    let settled = false;

    const callback = (result: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      const lastError = getRuntimeLastError();

      if (lastError?.message) {
        reject(new Error(lastError.message));
        return;
      }

      if (typeof result === "object" && result !== null) {
        resolve((result as Record<string, unknown>)[key]);
        return;
      }

      resolve(undefined);
    };

    try {
      const maybePromise = storageArea.get(key, callback) as Promise<unknown> | void;

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((result) => {
            if (settled) {
              return;
            }

            settled = true;

            if (typeof result === "object" && result !== null) {
              resolve((result as Record<string, unknown>)[key]);
              return;
            }

            resolve(undefined);
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

function setWithCompatibility(storageArea: StorageArea, items: Record<string, unknown>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const callback = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      const lastError = getRuntimeLastError();

      if (lastError?.message) {
        reject(new Error(lastError.message));
        return;
      }

      resolve();
    };

    try {
      const maybePromise = storageArea.set(items, callback) as Promise<unknown> | void;

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

export async function loadActivityFromStorage(storageArea?: StorageArea | null): Promise<TabActivity[]> {
  const resolvedStorageArea = getStorageArea(storageArea);

  if (!resolvedStorageArea) {
    return [];
  }

  const storedValue = await getWithCompatibility(resolvedStorageArea, ACTIVITY_STORAGE_KEY);
  return decodeStoredActivityState(storedValue);
}

export async function saveActivityToStorage(
  value: unknown,
  storageArea?: StorageArea | null
): Promise<StoredActivityStateV1> {
  const resolvedStorageArea = getStorageArea(storageArea);
  const envelope: StoredActivityStateV1 = {
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    activity: sanitizeActivity(value)
  };

  if (resolvedStorageArea) {
    await setWithCompatibility(resolvedStorageArea, {
      [ACTIVITY_STORAGE_KEY]: envelope
    });
  }

  return {
    schemaVersion: envelope.schemaVersion,
    activity: envelope.activity.map(cloneActivityRecord)
  };
}
