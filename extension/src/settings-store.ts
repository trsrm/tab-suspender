import type { Settings, SettingsSchemaVersion, StoredSettingsV1 } from "./types.js";
import { normalizeExcludedHostEntries } from "./matcher.js";
import {
  getKeyWithCompatibility,
  resolveStorageArea,
  setItemsWithCompatibility,
  type StorageAreaLike
} from "./storage-compat.js";

export const SETTINGS_STORAGE_KEY = "settings";
export const SETTINGS_SCHEMA_VERSION: SettingsSchemaVersion = 1;
export const MIN_IDLE_HOURS = 1;
export const MAX_IDLE_HOURS = 720;
export const MIN_IDLE_MINUTES = MIN_IDLE_HOURS * 60;
export const MAX_IDLE_MINUTES = MAX_IDLE_HOURS * 60;
export const MAX_EXCLUDED_HOST_LENGTH = 253;
export const MAX_EXCLUDED_HOSTS = 200;

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  idleMinutes: 24 * 60,
  excludedHosts: [],
  skipPinned: true,
  skipAudible: true
});

function cloneSettings(settings: Settings): Settings {
  return {
    idleMinutes: settings.idleMinutes,
    excludedHosts: [...settings.excludedHosts],
    skipPinned: settings.skipPinned,
    skipAudible: settings.skipAudible
  };
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

export async function loadSettingsFromStorage(storageArea?: StorageAreaLike | null): Promise<Settings> {
  const resolvedStorageArea = resolveStorageArea(storageArea);

  if (!resolvedStorageArea) {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  const storedValue = await getKeyWithCompatibility(resolvedStorageArea, SETTINGS_STORAGE_KEY);
  return decodeStoredSettings(storedValue);
}

export async function saveSettingsToStorage(
  value: unknown,
  storageArea?: StorageAreaLike | null
): Promise<StoredSettingsV1> {
  const resolvedStorageArea = resolveStorageArea(storageArea);
  const sanitizedSettings = sanitizeSettings(value, DEFAULT_SETTINGS);

  const envelope: StoredSettingsV1 = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    settings: sanitizedSettings
  };

  if (resolvedStorageArea) {
    await setItemsWithCompatibility(resolvedStorageArea, {
      [SETTINGS_STORAGE_KEY]: envelope
    });
  }

  return envelope;
}
