import type { SuspendReason } from "../types.js";
import { MAX_IDLE_HOURS, MIN_IDLE_HOURS } from "../settings-store.js";

export const RECOVERY_DEFAULT_TITLE = "Untitled tab";
export const SUSPEND_DIAGNOSTICS_REQUEST_TYPE = "GET_SUSPEND_DIAGNOSTICS_SNAPSHOT";
export const SUSPEND_DIAGNOSTICS_EMPTY_ROW = "No open tabs available for diagnostics.";

export const SUSPEND_REASON_ORDER: readonly SuspendReason[] = [
  "active",
  "pinned",
  "audible",
  "internalUrl",
  "urlTooLong",
  "excludedHost",
  "timeoutNotReached",
  "eligible"
];

export const SUSPEND_REASON_LABELS: Record<SuspendReason, string> = {
  active: "Active tab",
  pinned: "Pinned tab",
  audible: "Audible tab",
  internalUrl: "Internal or unsupported URL",
  urlTooLong: "URL exceeds max length",
  excludedHost: "Excluded host/profile",
  timeoutNotReached: "Idle timeout not reached",
  eligible: "Eligible for suspension"
};

export const optionsMessages = {
  settingsStatus: {
    loading: "Loading settings...",
    loaded: "Settings loaded.",
    loadFailedDefaults: "Failed to load settings. Using defaults.",
    savePending: "Saving settings...",
    saved: "Settings saved.",
    saveFailed: "Failed to save settings.",
    validationFailed: "Settings were not saved."
  },
  importExportStatus: {
    importLoading: "Reading configuration file...",
    importInvalid: "Failed to import configuration.",
    importPreviewReady: "Configuration ready to import.",
    importApplyPending: "Applying imported configuration...",
    importApplied: "Imported configuration applied.",
    importApplyFailed: "Failed to apply imported configuration.",
    importCanceled: "Import canceled.",
    exportPending: "Preparing configuration export...",
    exportReady: "Export started.",
    exportFailed: "Failed to export configuration.",
    noFileSelected: "Choose a configuration file to import first."
  },
  recoveryStatus: {
    reopenOk: "Reopened suspended tab in a new tab.",
    reopenFailed: "Failed to reopen suspended tab."
  },
  recoveryEmpty: {
    none: "No recently suspended tabs yet.",
    loadFailed: "Failed to load recently suspended tabs."
  },
  recoveryAction: {
    reopenButton: "Reopen",
    invalidRestoreUrlTitle: "URL is no longer eligible for restore."
  },
  diagnostics: {
    loading: "Loading suspension diagnostics...",
    loaded: "Suspension diagnostics updated.",
    failed: "Failed to load suspension diagnostics.",
    truncated: "Showing first 200 tabs.",
    summaryEmpty: "No tabs evaluated."
  },
  siteProfiles: {
    hostLabel: "Host rule",
    idleHoursLabel: "Idle override (hours)",
    skipPinnedLabel: "Skip pinned",
    skipAudibleLabel: "Skip audible",
    excludeFromSuspendLabel: "Exclude from suspend",
    deleteButton: "Delete"
  },
  validation: {
    idleHoursOutOfRange: `Enter a whole number from ${MIN_IDLE_HOURS} to ${MAX_IDLE_HOURS}.`
  }
} as const;
