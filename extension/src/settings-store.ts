import type { Settings, SettingsSchemaVersion, StoredSettingsV1 } from "./types.js";
import { normalizeExcludedHostEntries } from "./matcher.js";

export const SETTINGS_STORAGE_KEY = "settings";
export const SETTINGS_SCHEMA_VERSION: SettingsSchemaVersion = 1;
export const MIN_IDLE_MINUTES = 1;
export const MAX_IDLE_MINUTES = 1440;
export const MAX_EXCLUDED_HOST_LENGTH = 253;
export const MAX_EXCLUDED_HOSTS = 200;

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  idleMinutes: 60,
  excludedHosts: [],
  skipPinned: true,
  skipAudible: true
});

type StorageArea = {
  get: (...args: unknown[]) => unknown;
  set: (...args: unknown[]) => unknown;
};

function getRuntimeLastError(): { message?: string } | undefined {
  const runtime = (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome?.runtime;
  return runtime?.lastError;
}

function cloneSettings(settings: Settings): Settings {
  return {
    idleMinutes: settings.idleMinutes,
    excludedHosts: [...settings.excludedHosts],
    skipPinned: settings.skipPinned,
    skipAudible: settings.skipAudible
  };
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

function toInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
}

function sanitizeIdleMinutes(value: unknown, fallback: number): number {
  const parsed = toInteger(value);

  if (parsed === null) {
    return fallback;
  }

  return Math.min(MAX_IDLE_MINUTES, Math.max(MIN_IDLE_MINUTES, parsed));
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeExcludedHosts(value: unknown, fallback: string[]): string[] {
  const normalized = normalizeExcludedHostEntries(value, {
    maxEntries: MAX_EXCLUDED_HOSTS,
    maxHostLength: MAX_EXCLUDED_HOST_LENGTH
  });

  if (!Array.isArray(value) && typeof value !== "string") {
    return [...fallback];
  }

  return normalized.normalizedHosts;
}

export function sanitizeSettings(value: unknown, fallback: Settings = DEFAULT_SETTINGS): Settings {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    idleMinutes: sanitizeIdleMinutes(source.idleMinutes, fallback.idleMinutes),
    excludedHosts: sanitizeExcludedHosts(source.excludedHosts, fallback.excludedHosts),
    skipPinned: sanitizeBoolean(source.skipPinned, fallback.skipPinned),
    skipAudible: sanitizeBoolean(source.skipAudible, fallback.skipAudible)
  };
}

export function decodeStoredSettings(value: unknown): Settings {
  if (typeof value !== "object" || value === null) {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  return sanitizeSettings(record.settings, DEFAULT_SETTINGS);
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

export async function loadSettingsFromStorage(storageArea?: StorageArea | null): Promise<Settings> {
  const resolvedStorageArea = getStorageArea(storageArea);

  if (!resolvedStorageArea) {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  const storedValue = await getWithCompatibility(resolvedStorageArea, SETTINGS_STORAGE_KEY);
  return decodeStoredSettings(storedValue);
}

export async function saveSettingsToStorage(
  value: unknown,
  storageArea?: StorageArea | null
): Promise<StoredSettingsV1> {
  const resolvedStorageArea = getStorageArea(storageArea);
  const sanitizedSettings = sanitizeSettings(value, DEFAULT_SETTINGS);

  const envelope: StoredSettingsV1 = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    settings: sanitizedSettings
  };

  if (resolvedStorageArea) {
    await setWithCompatibility(resolvedStorageArea, {
      [SETTINGS_STORAGE_KEY]: envelope
    });
  }

  return envelope;
}
