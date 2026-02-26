export interface SiteProfileOverrides {
  idleMinutes?: number;
  skipPinned?: boolean;
  skipAudible?: boolean;
  excludeFromSuspend?: boolean;
}

export interface SiteProfile {
  id: string;
  hostRule: string;
  overrides: SiteProfileOverrides;
}

export interface Settings {
  idleMinutes: number;
  excludedHosts: string[];
  skipPinned: boolean;
  skipAudible: boolean;
  siteProfiles: SiteProfile[];
}

export type SettingsSchemaVersion = 1 | 2;

export interface StoredSettingsV1 {
  schemaVersion: 1;
  settings: Omit<Settings, "siteProfiles">;
}

export interface StoredSettingsV2 {
  schemaVersion: 2;
  settings: Settings;
}

export interface ResolvedPolicySettings {
  settings: Settings;
  matchedProfileId: string | null;
}

export type ActivitySchemaVersion = 1;

export interface StoredActivityStateV1 {
  schemaVersion: ActivitySchemaVersion;
  activity: TabActivity[];
}

export interface RecoveryEntry {
  url: string;
  title: string;
  suspendedAtMinute: number;
}

export type RecoverySchemaVersion = 1;

export interface StoredRecoveryStateV1 {
  schemaVersion: RecoverySchemaVersion;
  entries: RecoveryEntry[];
}

export type PortableConfigExportVersion = 1;

export interface PortableRecoveryStateV1 {
  schemaVersion: RecoverySchemaVersion;
  entries: RecoveryEntry[];
}

export interface PortableConfigV1 {
  exportSchemaVersion: PortableConfigExportVersion;
  generatedAtMinute: number;
  settings: StoredSettingsV2["settings"];
  recoveryState: PortableRecoveryStateV1;
}

export interface PortableImportPreview {
  exportSchemaVersion: PortableConfigExportVersion;
  generatedAtMinute: number;
  counts: {
    excludedHosts: number;
    siteProfiles: number;
    recoveryEntries: number;
  };
  ignoredInvalid: {
    excludedHosts: number;
    siteProfiles: number;
    recoveryEntries: number;
  };
}

export type PortableImportErrorCode =
  | "invalidJson"
  | "invalidEnvelope"
  | "unsupportedExportSchemaVersion";

export type PortableImportResult =
  | {
      ok: true;
      config: PortableConfigV1;
      preview: PortableImportPreview;
    }
  | {
      ok: false;
      code: PortableImportErrorCode;
      message: string;
    };

export type SuspendReason =
  | "eligible"
  | "active"
  | "pinned"
  | "audible"
  | "excludedHost"
  | "internalUrl"
  | "timeoutNotReached"
  | "urlTooLong";

export interface SuspendDecision {
  shouldSuspend: boolean;
  reason: SuspendReason;
}

export interface SuspendDiagnosticsRequest {
  type: "GET_SUSPEND_DIAGNOSTICS_SNAPSHOT";
}

export interface SuspendDiagnosticsEntry {
  tabId: number;
  title: string;
  url: string;
  reason: SuspendReason;
  shouldSuspend: boolean;
}

export type SuspendDiagnosticsSummary = Record<SuspendReason, number>;

export type SuspendDiagnosticsResponse =
  | {
      ok: true;
      generatedAtMinute: number;
      totalTabs: number;
      entries: SuspendDiagnosticsEntry[];
      summary: SuspendDiagnosticsSummary;
      truncated: boolean;
    }
  | {
      ok: false;
      message: string;
    };

export interface TabActivity {
  tabId: number;
  windowId: number;
  lastActiveAtMinute: number;
  lastUpdatedAtMinute: number;
}

export interface SuspendPayload {
  u: string;
  t: string;
  ts: number;
}

export type SuspendedPageFormat = "extensionPage" | "dataUrl";

export interface DecodedSuspendPayload extends SuspendPayload {
  format: SuspendedPageFormat;
}

export interface PolicyTabSnapshot {
  active: boolean;
  pinned: boolean;
  audible: boolean;
  url?: string | null;
}

export interface PolicyEvaluatorInput {
  tab: PolicyTabSnapshot;
  activity?: Pick<TabActivity, "lastActiveAtMinute" | "lastUpdatedAtMinute"> | null;
  settings: Settings;
  nowMinute: number;
  flags?: {
    internalUrl?: boolean;
    excludedHost?: boolean;
    urlTooLong?: boolean;
  };
}

export interface TabUpdatedChangeInfo {
  status?: string;
  url?: string;
}

export interface StorageChange {
  newValue?: unknown;
  oldValue?: unknown;
}

export type StorageOnChangedMap = Record<string, StorageChange>;

export function isMeaningfulTabUpdatedChangeInfo(value: unknown): value is TabUpdatedChangeInfo {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const typed = value as TabUpdatedChangeInfo;
  return typeof typed.status === "string" || typeof typed.url === "string";
}

export function isStorageOnChangedMap(value: unknown): value is StorageOnChangedMap {
  return typeof value === "object" && value !== null;
}

export function isStorageChange(value: unknown): value is StorageChange {
  return typeof value === "object" && value !== null;
}

export function isSuspendDiagnosticsRequest(value: unknown): value is SuspendDiagnosticsRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const typed = value as SuspendDiagnosticsRequest;
  return typed.type === "GET_SUSPEND_DIAGNOSTICS_SNAPSHOT";
}
