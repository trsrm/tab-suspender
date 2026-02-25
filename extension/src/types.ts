export interface Settings {
  idleMinutes: number;
  excludedHosts: string[];
  skipPinned: boolean;
  skipAudible: boolean;
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
  lastActiveAtMs: number;
  lastUpdatedAtMs: number;
}
