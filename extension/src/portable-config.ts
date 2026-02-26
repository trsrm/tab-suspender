import {
  createSettingsEnvelope,
  MAX_EXCLUDED_HOST_LENGTH,
  MAX_EXCLUDED_HOSTS,
  MAX_SITE_PROFILE_HOST_LENGTH,
  MAX_SITE_PROFILES
} from "./settings-store.js";
import { RECOVERY_SCHEMA_VERSION, createRecoveryEnvelope } from "./recovery-store.js";
import { normalizeExcludedHostEntries, normalizeSiteProfiles } from "./matcher.js";
import { MAX_RESTORABLE_URL_LENGTH, validateRestorableUrl } from "./url-safety.js";
import type {
  PortableConfigV1,
  PortableImportErrorCode,
  PortableImportResult,
  RecoveryEntry,
  Settings
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidGeneratedAtMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

function countInvalidRecoveryEntries(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  let invalidCount = 0;

  for (const entry of value) {
    if (!isRecord(entry)) {
      invalidCount += 1;
      continue;
    }

    if (typeof entry.suspendedAtMinute !== "number" || !Number.isInteger(entry.suspendedAtMinute) || entry.suspendedAtMinute < 0) {
      invalidCount += 1;
      continue;
    }

    const rawUrl = typeof entry.url === "string" ? entry.url : "";
    const normalizedUrl = rawUrl.trim().slice(0, MAX_RESTORABLE_URL_LENGTH);

    if (!validateRestorableUrl(normalizedUrl).ok) {
      invalidCount += 1;
    }
  }

  return invalidCount;
}

function buildPortableImportError(code: PortableImportErrorCode, message: string): PortableImportResult {
  return {
    ok: false as const,
    code,
    message
  };
}

export function buildPortableConfig(settings: Settings, recoveryEntries: RecoveryEntry[], nowMinute: number): PortableConfigV1 {
  const generatedAtMinute = Math.max(0, Math.floor(nowMinute));

  return {
    exportSchemaVersion: 1,
    generatedAtMinute,
    settings: {
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
    },
    recoveryState: {
      schemaVersion: RECOVERY_SCHEMA_VERSION,
      entries: recoveryEntries.map((entry) => ({
        url: entry.url,
        title: entry.title,
        suspendedAtMinute: entry.suspendedAtMinute
      }))
    }
  };
}

export function serializePortableConfig(config: PortableConfigV1): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export async function parsePortableConfigJson(rawText: string): Promise<PortableImportResult> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return buildPortableImportError("invalidJson", "Invalid JSON file.");
  }

  if (!isRecord(parsed)) {
    return buildPortableImportError("invalidEnvelope", "Invalid configuration envelope.");
  }

  if (parsed.exportSchemaVersion !== 1) {
    return buildPortableImportError("unsupportedExportSchemaVersion", "Unsupported export schema version.");
  }

  if (!isValidGeneratedAtMinute(parsed.generatedAtMinute)) {
    return buildPortableImportError("invalidEnvelope", "Invalid generatedAtMinute value.");
  }

  if (!isRecord(parsed.settings) || !isRecord(parsed.recoveryState)) {
    return buildPortableImportError("invalidEnvelope", "Missing required settings or recovery state.");
  }

  const recoveryState = parsed.recoveryState;

  if (recoveryState.schemaVersion !== RECOVERY_SCHEMA_VERSION || !Array.isArray(recoveryState.entries)) {
    return buildPortableImportError("invalidEnvelope", "Invalid recovery state envelope.");
  }

  const sanitizedSettingsEnvelope = createSettingsEnvelope(parsed.settings);
  const sanitizedRecoveryEnvelope = createRecoveryEnvelope(recoveryState.entries);
  const excludedHostNormalization = normalizeExcludedHostEntries(parsed.settings.excludedHosts, {
    maxEntries: MAX_EXCLUDED_HOSTS,
    maxHostLength: MAX_EXCLUDED_HOST_LENGTH
  });
  const siteProfileNormalization = normalizeSiteProfiles(parsed.settings.siteProfiles, {
    maxEntries: MAX_SITE_PROFILES,
    maxHostLength: MAX_SITE_PROFILE_HOST_LENGTH
  });

  return {
    ok: true,
    config: {
      exportSchemaVersion: 1,
      generatedAtMinute: parsed.generatedAtMinute,
      settings: sanitizedSettingsEnvelope.settings,
      recoveryState: {
        schemaVersion: RECOVERY_SCHEMA_VERSION,
        entries: sanitizedRecoveryEnvelope.entries
      }
    },
    preview: {
      exportSchemaVersion: 1,
      generatedAtMinute: parsed.generatedAtMinute,
      counts: {
        excludedHosts: sanitizedSettingsEnvelope.settings.excludedHosts.length,
        siteProfiles: sanitizedSettingsEnvelope.settings.siteProfiles.length,
        recoveryEntries: sanitizedRecoveryEnvelope.entries.length
      },
      ignoredInvalid: {
        excludedHosts: excludedHostNormalization.ignoredInvalidCount,
        siteProfiles: siteProfileNormalization.ignoredInvalidCount,
        recoveryEntries: countInvalidRecoveryEntries(recoveryState.entries)
      }
    }
  };
}
