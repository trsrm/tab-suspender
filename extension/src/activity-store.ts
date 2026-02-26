import type { ActivitySchemaVersion, StoredActivityStateV1, TabActivity } from "./types.js";
import {
  getKeyWithCompatibility,
  resolveStorageArea,
  setItemsWithCompatibility,
  type StorageAreaLike
} from "./storage-compat.js";

export const ACTIVITY_STORAGE_KEY = "activityState";
export const ACTIVITY_SCHEMA_VERSION: ActivitySchemaVersion = 1;
export const MAX_ACTIVITY_RECORDS = 2_000;
const WINDOW_ID_NONE = -1;

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
  // Invariant: persisted activity never has lastUpdated earlier than lastActive.
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
      // Invariant: dedupe winner is the most recently updated (then most recently active) record per tab.
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

export async function loadActivityFromStorage(storageArea?: StorageAreaLike | null): Promise<TabActivity[]> {
  const resolvedStorageArea = resolveStorageArea(storageArea);

  if (!resolvedStorageArea) {
    return [];
  }

  const storedValue = await getKeyWithCompatibility(resolvedStorageArea, ACTIVITY_STORAGE_KEY);
  return decodeStoredActivityState(storedValue);
}

export async function saveActivityToStorage(
  value: unknown,
  storageArea?: StorageAreaLike | null
): Promise<StoredActivityStateV1> {
  const resolvedStorageArea = resolveStorageArea(storageArea);
  const envelope: StoredActivityStateV1 = {
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    activity: sanitizeActivity(value)
  };

  if (resolvedStorageArea) {
    await setItemsWithCompatibility(resolvedStorageArea, {
      [ACTIVITY_STORAGE_KEY]: envelope
    });
  }

  return {
    schemaVersion: envelope.schemaVersion,
    activity: envelope.activity.map(cloneActivityRecord)
  };
}
