import type {
  Settings,
  SettingsSchemaVersion,
  StoredSettingsV2
} from "./types.js";
import { normalizeExcludedHostEntries, normalizeSiteProfiles } from "./matcher.js";
import {
  getKeyWithCompatibility,
  resolveStorageArea,
  setItemsWithCompatibility,
  type StorageAreaLike
} from "./storage-compat.js";

export const SETTINGS_STORAGE_KEY = "settings";
export const SETTINGS_SCHEMA_VERSION: SettingsSchemaVersion = 2;
export const MIN_IDLE_HOURS = 1;
export const MAX_IDLE_HOURS = 720;
export const MIN_IDLE_MINUTES = MIN_IDLE_HOURS * 60;
export const MAX_IDLE_MINUTES = MAX_IDLE_HOURS * 60;
export const MAX_EXCLUDED_HOST_LENGTH = 253;
export const MAX_EXCLUDED_HOSTS = 200;
export const MAX_SITE_PROFILE_HOST_LENGTH = 253;
export const MAX_SITE_PROFILES = 200;

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  idleMinutes: 24 * 60,
  excludedHosts: [],
  skipPinned: true,
  skipAudible: true,
  siteProfiles: []
});

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

  // Invariant: malformed host payload types do not wipe a previously valid fallback set.
  if (!Array.isArray(value) && typeof value !== "string") {
    return [...fallback];
  }

  return normalized.normalizedHosts;
}

function sanitizeSiteProfiles(value: unknown, fallback: Settings["siteProfiles"]): Settings["siteProfiles"] {
  if (!Array.isArray(value)) {
    return fallback.map((profile) => ({
      id: profile.id,
      hostRule: profile.hostRule,
      overrides: {
        ...profile.overrides
      }
    }));
  }

  const normalized = normalizeSiteProfiles(value, {
    maxEntries: MAX_SITE_PROFILES,
    maxHostLength: MAX_SITE_PROFILE_HOST_LENGTH
  });

  return normalized.normalizedProfiles;
}

function sanitizeSettingsV2(value: unknown, fallback: Settings = DEFAULT_SETTINGS): Settings {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    idleMinutes: sanitizeIdleMinutes(source.idleMinutes, fallback.idleMinutes),
    excludedHosts: sanitizeExcludedHosts(source.excludedHosts, fallback.excludedHosts),
    skipPinned: sanitizeBoolean(source.skipPinned, fallback.skipPinned),
    skipAudible: sanitizeBoolean(source.skipAudible, fallback.skipAudible),
    siteProfiles: sanitizeSiteProfiles(source.siteProfiles, fallback.siteProfiles)
  };
}

function sanitizeSettingsV1(value: unknown, fallback: Settings = DEFAULT_SETTINGS): Settings {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    idleMinutes: sanitizeIdleMinutes(source.idleMinutes, fallback.idleMinutes),
    excludedHosts: sanitizeExcludedHosts(source.excludedHosts, fallback.excludedHosts),
    skipPinned: sanitizeBoolean(source.skipPinned, fallback.skipPinned),
    skipAudible: sanitizeBoolean(source.skipAudible, fallback.skipAudible),
    siteProfiles: []
  };
}

export function sanitizeSettings(value: unknown, fallback: Settings = DEFAULT_SETTINGS): Settings {
  return sanitizeSettingsV2(value, fallback);
}

export function decodeStoredSettings(value: unknown): Settings {
  if (typeof value !== "object" || value === null) {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  const record = value as Record<string, unknown>;

  if (record.schemaVersion === 2) {
    return sanitizeSettingsV2(record.settings, DEFAULT_SETTINGS);
  }

  if (record.schemaVersion === 1) {
    return sanitizeSettingsV1(record.settings, DEFAULT_SETTINGS);
  }

  return cloneSettings(DEFAULT_SETTINGS);
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
): Promise<StoredSettingsV2> {
  const resolvedStorageArea = resolveStorageArea(storageArea);
  const envelope = createSettingsEnvelope(value);

  if (resolvedStorageArea) {
    await setItemsWithCompatibility(resolvedStorageArea, {
      [SETTINGS_STORAGE_KEY]: envelope
    });
  }

  return envelope;
}

export function createSettingsEnvelope(value: unknown): StoredSettingsV2 {
  const sanitizedSettings = sanitizeSettingsV2(value, DEFAULT_SETTINGS);

  return {
    schemaVersion: 2,
    settings: sanitizedSettings
  };
}
