import { evaluateSuspendDecision } from "../policy.js";
import type {
  DecodedSuspendPayload,
  SuspendDecision,
  SuspendDiagnosticsEntry,
  SuspendDiagnosticsResponse,
  SuspendDiagnosticsSummary,
  PolicyEvaluatorInput,
  RecoveryEntry,
  ResolvedPolicySettings,
  Settings,
  SuspendPayload,
  SuspendReason,
  TabActivity
} from "../types.js";
import { validateRestorableUrlWithMetadata } from "../url-safety.js";
import { findMatchingSiteProfile, matchesExcludedHost } from "../matcher.js";
import { MAX_RECOVERY_ENTRIES } from "../recovery-store.js";
import {
  buildSuspendedDataUrl,
  decodeLegacySuspendPayloadFromUrl,
  decodeSuspendPayloadFromDataUrl,
  sanitizeSuspendedTitle
} from "../suspended-payload.js";
import type { QueryTab } from "./activity-runtime.js";
import { isValidId } from "./activity-runtime.js";

type SuspendEvaluationOptions = {
  ignoreActive?: boolean;
  forceTimeoutReached?: boolean;
};

type TabUrlAnalysis = {
  internalUrl: boolean;
  urlTooLong: boolean;
  excludedHost: boolean;
  restorableUrl: string | null;
};

type CreateSuspendRunnerOptions = {
  queryTabs: (queryInfo: Record<string, unknown>) => Promise<QueryTab[]>;
  updateTab: (tabId: number, updateProperties: Record<string, unknown>) => Promise<void>;
  waitForRuntimeReady: () => Promise<void>;
  getCurrentEpochMinute: () => number;
  getCurrentSettings: () => Settings;
  getActivityForTab: (tabId: number) => TabActivity | undefined;
  ensureTabActivityBaseline: (tab: QueryTab, nowMinute: number) => boolean;
  markTabUpdated: (tabId: number, windowId: number | undefined, minute: number) => boolean;
  schedulePersistActivity: () => void;
  appendRecoveryEntry: (entry: RecoveryEntry) => void;
  schedulePersistRecovery: () => void;
  log: (message: string, details?: unknown) => void;
};

export type SuspendRunner = ReturnType<typeof createSuspendRunner>;
const MAX_SUSPEND_DIAGNOSTICS_ENTRIES = 200;
const SUSPEND_REASON_ORDER: readonly SuspendReason[] = [
  "active",
  "pinned",
  "audible",
  "internalUrl",
  "urlTooLong",
  "excludedHost",
  "timeoutNotReached",
  "eligible"
];

export function computeSweepIntervalMinutes(settings: Settings): number {
  const interval = Math.floor(settings.idleMinutes / 120);
  return Math.min(30, Math.max(1, interval));
}

export function buildSuspendSweepQueryInfo(settings: Settings): Record<string, unknown> {
  const queryInfo: Record<string, unknown> = {
    active: false
  };

  const hasSiteProfiles = settings.siteProfiles.length > 0;

  if (settings.skipPinned && !hasSiteProfiles) {
    queryInfo.pinned = false;
  }

  if (settings.skipAudible && !hasSiteProfiles) {
    queryInfo.audible = false;
  }

  return queryInfo;
}

export function decodeSuspendedTabPayload(url: string | undefined): DecodedSuspendPayload | null {
  if (typeof url !== "string" || url.length === 0) {
    return null;
  }

  const dataPayload = decodeSuspendPayloadFromDataUrl(url);

  if (dataPayload) {
    return dataPayload;
  }

  return decodeLegacySuspendPayloadFromUrl(url);
}

export function encodeSuspendedUrl(payload: SuspendPayload): string {
  return buildSuspendedDataUrl(payload);
}

function getSyntheticTimedOutActivity(
  nowMinute: number,
  settings: Settings
): Pick<TabActivity, "lastActiveAtMinute" | "lastUpdatedAtMinute"> {
  const eligibleReferenceMinute = nowMinute - settings.idleMinutes;

  return {
    lastActiveAtMinute: eligibleReferenceMinute,
    lastUpdatedAtMinute: eligibleReferenceMinute
  };
}

function buildPolicyInput(
  tab: QueryTab,
  nowMinute: number,
  settings: Settings,
  activity: Pick<TabActivity, "lastActiveAtMinute" | "lastUpdatedAtMinute"> | null,
  urlAnalysis: TabUrlAnalysis,
  options: SuspendEvaluationOptions = {}
): PolicyEvaluatorInput {
  return {
    tab: {
      active: options.ignoreActive ? false : tab.active === true,
      pinned: tab.pinned === true,
      audible: tab.audible === true,
      url: tab.url
    },
    activity,
    settings,
    nowMinute,
    flags: {
      internalUrl: urlAnalysis.internalUrl,
      excludedHost: urlAnalysis.excludedHost,
      urlTooLong: urlAnalysis.urlTooLong
    }
  };
}

function buildSuspendPayload(tab: QueryTab, restorableUrl: string, nowMinute: number): SuspendPayload {
  return {
    u: restorableUrl,
    t: sanitizeSuspendedTitle(tab.title),
    ts: nowMinute
  };
}

function createEmptySuspendDiagnosticsSummary(): SuspendDiagnosticsSummary {
  return {
    active: 0,
    pinned: 0,
    audible: 0,
    internalUrl: 0,
    urlTooLong: 0,
    excludedHost: 0,
    timeoutNotReached: 0,
    eligible: 0
  };
}

function getSuspendReasonRank(reason: SuspendReason): number {
  const index = SUSPEND_REASON_ORDER.indexOf(reason);
  return index === -1 ? SUSPEND_REASON_ORDER.length : index;
}

function resolvePolicySettingsForHostname(settings: Settings, hostname: string | null): ResolvedPolicySettings {
  if (!hostname) {
    return {
      settings,
      matchedProfileId: null
    };
  }

  const matchedProfile = findMatchingSiteProfile(hostname, settings.siteProfiles);

  if (!matchedProfile) {
    return {
      settings,
      matchedProfileId: null
    };
  }

  return {
    settings: {
      ...settings,
      idleMinutes: matchedProfile.overrides.idleMinutes ?? settings.idleMinutes,
      skipPinned: matchedProfile.overrides.skipPinned ?? settings.skipPinned,
      skipAudible: matchedProfile.overrides.skipAudible ?? settings.skipAudible
    },
    matchedProfileId: matchedProfile.id
  };
}

function analyzeTabUrl(tab: QueryTab, settings: Settings): TabUrlAnalysis {
  const validation = validateRestorableUrlWithMetadata(tab.url);

  if (!validation.ok) {
    return {
      internalUrl: validation.reason !== "tooLong",
      urlTooLong: validation.reason === "tooLong",
      excludedHost: false,
      restorableUrl: null
    };
  }

  return {
    internalUrl: false,
    urlTooLong: false,
    excludedHost: matchesExcludedHost(validation.hostname, settings.excludedHosts),
    restorableUrl: validation.url
  };
}

export function createSuspendRunner(options: CreateSuspendRunnerOptions) {
  let hasLoggedFilteredSweepQueryFailure = false;

  function evaluateTabSuspendDecision(
    tab: QueryTab,
    nowMinute: number,
    evaluationOptions: SuspendEvaluationOptions = {}
  ): {
    decision: SuspendDecision;
    urlAnalysis: TabUrlAnalysis;
  } {
    const settings = options.getCurrentSettings();
    const urlAnalysis = analyzeTabUrl(tab, settings);
    const resolvedPolicySettings = resolvePolicySettingsForHostname(
      settings,
      urlAnalysis.restorableUrl ? new URL(urlAnalysis.restorableUrl).hostname : null
    );
    const matchedProfile = resolvedPolicySettings.matchedProfileId
      ? settings.siteProfiles.find((profile) => profile.id === resolvedPolicySettings.matchedProfileId) ?? null
      : null;
    const effectiveSettings = resolvedPolicySettings.settings;
    const profileExcluded = matchedProfile?.overrides.excludeFromSuspend === true;
    const activity = evaluationOptions.forceTimeoutReached
      ? getSyntheticTimedOutActivity(nowMinute, effectiveSettings)
      : isValidId(tab.id)
        ? options.getActivityForTab(tab.id) ?? null
        : null;
    const decision = evaluateSuspendDecision(
      buildPolicyInput(
        tab,
        nowMinute,
        effectiveSettings,
        activity,
        {
          ...urlAnalysis,
          excludedHost: urlAnalysis.excludedHost || profileExcluded
        },
        evaluationOptions
      )
    );

    return { decision, urlAnalysis };
  }

  async function suspendTabIfEligible(
    tab: QueryTab,
    nowMinute: number,
    evaluationOptions: SuspendEvaluationOptions = {}
  ): Promise<void> {
    if (decodeSuspendedTabPayload(tab.url)) {
      return;
    }

    if (!isValidId(tab.id)) {
      return;
    }

    if (!evaluationOptions.forceTimeoutReached && options.ensureTabActivityBaseline(tab, nowMinute)) {
      options.schedulePersistActivity();
    }

    const { decision, urlAnalysis } = evaluateTabSuspendDecision(tab, nowMinute, evaluationOptions);

    if (!decision.shouldSuspend) {
      return;
    }

    if (!urlAnalysis.restorableUrl) {
      options.log("Skipped eligible suspend candidate due missing URL payload.", { tabId: tab.id });
      return;
    }

    const payload = buildSuspendPayload(tab, urlAnalysis.restorableUrl, nowMinute);

    try {
      await options.updateTab(tab.id, { url: encodeSuspendedUrl(payload) });
      options.markTabUpdated(tab.id, tab.windowId, nowMinute);
      options.schedulePersistActivity();
      options.appendRecoveryEntry({
        url: payload.u,
        title: payload.t,
        suspendedAtMinute: nowMinute
      });
      options.schedulePersistRecovery();
    } catch (error) {
      options.log("Failed to suspend tab.", {
        tabId: tab.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function runSuspendSweep(nowMinute = options.getCurrentEpochMinute()): Promise<void> {
    await options.waitForRuntimeReady();

    let tabs: QueryTab[];
    const filteredQueryInfo = buildSuspendSweepQueryInfo(options.getCurrentSettings());

    try {
      tabs = await options.queryTabs(filteredQueryInfo);
    } catch (error) {
      if (!hasLoggedFilteredSweepQueryFailure) {
        hasLoggedFilteredSweepQueryFailure = true;
        options.log("Filtered tab query failed for suspend sweep. Falling back to unfiltered query.", error);
      }

      try {
        tabs = await options.queryTabs({});
      } catch (fallbackError) {
        options.log("Failed to query tabs for suspend sweep.", fallbackError);
        return;
      }
    }

    for (const tab of tabs) {
      await suspendTabIfEligible(tab, nowMinute);
    }
  }

  async function suspendFromAction(tab: QueryTab | undefined, nowMinute = options.getCurrentEpochMinute()): Promise<void> {
    await options.waitForRuntimeReady();

    if (!tab) {
      return;
    }

    await suspendTabIfEligible(tab, nowMinute, {
      ignoreActive: true,
      forceTimeoutReached: true
    });
  }

  async function getSuspendDiagnosticsSnapshot(
    nowMinute = options.getCurrentEpochMinute()
  ): Promise<SuspendDiagnosticsResponse> {
    await options.waitForRuntimeReady();

    let tabs: QueryTab[];

    try {
      tabs = await options.queryTabs({});
    } catch (error) {
      options.log("Failed to query tabs for suspend diagnostics.", error);
      return {
        ok: false,
        message: "Failed to read open tabs for diagnostics."
      };
    }

    const totalTabs = tabs.length;
    const summary = createEmptySuspendDiagnosticsSummary();
    const entries: SuspendDiagnosticsEntry[] = [];
    const maxEntries = Math.min(totalTabs, MAX_SUSPEND_DIAGNOSTICS_ENTRIES);
    let entryCount = 0;

    for (const tab of tabs) {
      const { decision } = evaluateTabSuspendDecision(tab, nowMinute);
      const reason = decision.reason;
      summary[reason] += 1;

      if (entryCount < maxEntries) {
        entries.push({
          tabId: isValidId(tab.id) ? tab.id : -1,
          title: typeof tab.title === "string" ? tab.title : "",
          url: typeof tab.url === "string" ? tab.url : "",
          reason,
          shouldSuspend: decision.shouldSuspend
        });
        entryCount += 1;
      }
    }

    entries.sort((left, right) => {
      const reasonRankDelta = getSuspendReasonRank(left.reason) - getSuspendReasonRank(right.reason);
      if (reasonRankDelta !== 0) {
        return reasonRankDelta;
      }
      return left.tabId - right.tabId;
    });

    return {
      ok: true,
      generatedAtMinute: nowMinute,
      totalTabs,
      entries,
      summary,
      truncated: totalTabs > entries.length
    };
  }

  return {
    runSuspendSweep,
    suspendFromAction,
    getSuspendDiagnosticsSnapshot,
    appendRecoveryEntryWithCap(entry: RecoveryEntry, currentEntries: RecoveryEntry[]): RecoveryEntry[] {
      return [entry, ...currentEntries].slice(0, MAX_RECOVERY_ENTRIES * 2);
    }
  };
}
