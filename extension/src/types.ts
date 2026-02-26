export interface Settings {
  idleMinutes: number;
  excludedHosts: string[];
  skipPinned: boolean;
  skipAudible: boolean;
}

export type SettingsSchemaVersion = 1;

export interface StoredSettingsV1 {
  schemaVersion: SettingsSchemaVersion;
  settings: Settings;
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
