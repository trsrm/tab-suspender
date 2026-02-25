import type { RecoveryEntry, RecoverySchemaVersion, StoredRecoveryStateV1 } from "./types.js";
import { MAX_RESTORABLE_URL_LENGTH, validateRestorableUrl } from "./url-safety.js";

export const RECOVERY_STORAGE_KEY = "recoveryState";
export const RECOVERY_SCHEMA_VERSION: RecoverySchemaVersion = 1;
export const MAX_RECOVERY_ENTRIES = 100;
const MAX_RECOVERY_TITLE_LENGTH = 120;

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

function cloneEntry(entry: RecoveryEntry): RecoveryEntry {
  return {
    url: entry.url,
    title: entry.title,
    suspendedAtMinute: entry.suspendedAtMinute
  };
}

function sanitizeEntry(value: unknown): RecoveryEntry | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (typeof source.suspendedAtMinute !== "number" || !Number.isInteger(source.suspendedAtMinute) || source.suspendedAtMinute < 0) {
    return null;
  }

  const normalizedTitle = typeof source.title === "string" ? source.title.trim().slice(0, MAX_RECOVERY_TITLE_LENGTH) : "";
  const rawUrl = typeof source.url === "string" ? source.url : "";
  const normalizedUrl = rawUrl.trim().slice(0, MAX_RESTORABLE_URL_LENGTH);
  const validation = validateRestorableUrl(normalizedUrl);

  if (!validation.ok) {
    return null;
  }

  return {
    url: validation.url,
    title: normalizedTitle,
    suspendedAtMinute: source.suspendedAtMinute
  };
}

function sanitizeEntries(value: unknown): RecoveryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const dedupedByUrl = new Map<string, RecoveryEntry>();

  for (const entry of value) {
    const sanitized = sanitizeEntry(entry);

    if (!sanitized) {
      continue;
    }

    const existing = dedupedByUrl.get(sanitized.url);

    if (!existing || sanitized.suspendedAtMinute > existing.suspendedAtMinute) {
      dedupedByUrl.set(sanitized.url, sanitized);
    }
  }

  return Array.from(dedupedByUrl.values())
    .sort((a, b) => b.suspendedAtMinute - a.suspendedAtMinute)
    .slice(0, MAX_RECOVERY_ENTRIES)
    .map(cloneEntry);
}

export function decodeStoredRecoveryState(value: unknown): RecoveryEntry[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== RECOVERY_SCHEMA_VERSION) {
    return [];
  }

  return sanitizeEntries(record.entries);
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

export async function loadRecoveryFromStorage(storageArea?: StorageArea | null): Promise<RecoveryEntry[]> {
  const resolvedStorageArea = getStorageArea(storageArea);

  if (!resolvedStorageArea) {
    return [];
  }

  const storedValue = await getWithCompatibility(resolvedStorageArea, RECOVERY_STORAGE_KEY);
  return decodeStoredRecoveryState(storedValue);
}

export async function saveRecoveryToStorage(
  entries: unknown,
  storageArea?: StorageArea | null
): Promise<StoredRecoveryStateV1> {
  const resolvedStorageArea = getStorageArea(storageArea);
  const envelope: StoredRecoveryStateV1 = {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    entries: sanitizeEntries(entries)
  };

  if (resolvedStorageArea) {
    await setWithCompatibility(resolvedStorageArea, {
      [RECOVERY_STORAGE_KEY]: envelope
    });
  }

  return {
    schemaVersion: envelope.schemaVersion,
    entries: envelope.entries.map(cloneEntry)
  };
}
