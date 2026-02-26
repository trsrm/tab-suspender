import type { RecoveryEntry, RecoverySchemaVersion, StoredRecoveryStateV1 } from "./types.js";
import { MAX_SUSPENDED_TITLE_LENGTH } from "./suspended-payload.js";
import { MAX_RESTORABLE_URL_LENGTH, validateRestorableUrl } from "./url-safety.js";
import {
  getKeyWithCompatibility,
  resolveStorageArea,
  setItemsWithCompatibility,
  type StorageAreaLike
} from "./storage-compat.js";

export const RECOVERY_STORAGE_KEY = "recoveryState";
export const RECOVERY_SCHEMA_VERSION: RecoverySchemaVersion = 1;
export const MAX_RECOVERY_ENTRIES = 100;

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

  const normalizedTitle = typeof source.title === "string"
    ? source.title.trim().slice(0, MAX_SUSPENDED_TITLE_LENGTH)
    : "";
  const rawUrl = typeof source.url === "string" ? source.url : "";
  const normalizedUrl = rawUrl.trim().slice(0, MAX_RESTORABLE_URL_LENGTH);
  const validation = validateRestorableUrl(normalizedUrl);

  if (!validation.ok) {
    return null;
  }

  // Invariant: every persisted recovery entry has a validated restorable URL.
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
      // Invariant: dedupe winner is the most recent capture for a canonicalized URL.
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

export async function loadRecoveryFromStorage(storageArea?: StorageAreaLike | null): Promise<RecoveryEntry[]> {
  const resolvedStorageArea = resolveStorageArea(storageArea);

  if (!resolvedStorageArea) {
    return [];
  }

  const storedValue = await getKeyWithCompatibility(resolvedStorageArea, RECOVERY_STORAGE_KEY);
  return decodeStoredRecoveryState(storedValue);
}

export async function saveRecoveryToStorage(
  entries: unknown,
  storageArea?: StorageAreaLike | null
): Promise<StoredRecoveryStateV1> {
  const resolvedStorageArea = resolveStorageArea(storageArea);
  const envelope: StoredRecoveryStateV1 = {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    entries: sanitizeEntries(entries)
  };

  if (resolvedStorageArea) {
    await setItemsWithCompatibility(resolvedStorageArea, {
      [RECOVERY_STORAGE_KEY]: envelope
    });
  }

  return {
    schemaVersion: envelope.schemaVersion,
    entries: envelope.entries.map(cloneEntry)
  };
}
