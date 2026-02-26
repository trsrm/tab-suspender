import { evaluateSuspendDecision } from "../policy.js";
import type { DecodedSuspendPayload, PolicyEvaluatorInput, RecoveryEntry, Settings, SuspendPayload, TabActivity } from "../types.js";
import { validateRestorableUrl } from "../url-safety.js";
import { isExcludedUrlByHost } from "../matcher.js";
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

export function computeSweepIntervalMinutes(settings: Settings): number {
  const interval = Math.floor(settings.idleMinutes / 120);
  return Math.min(30, Math.max(1, interval));
}

export function buildSuspendSweepQueryInfo(settings: Settings): Record<string, unknown> {
  const queryInfo: Record<string, unknown> = {
    active: false
  };

  if (settings.skipPinned) {
    queryInfo.pinned = false;
  }

  if (settings.skipAudible) {
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
  options: SuspendEvaluationOptions = {}
): PolicyEvaluatorInput {
  const urlValidation = validateRestorableUrl(tab.url);

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
      excludedHost: isExcludedUrlByHost(tab.url ?? null, settings.excludedHosts),
      urlTooLong: urlValidation.ok ? false : urlValidation.reason === "tooLong"
    }
  };
}

function buildSuspendPayload(tab: QueryTab, nowMinute: number): SuspendPayload | null {
  const urlValidation = validateRestorableUrl(tab.url);

  if (!urlValidation.ok) {
    return null;
  }

  return {
    u: urlValidation.url,
    t: sanitizeSuspendedTitle(tab.title),
    ts: nowMinute
  };
}

export function createSuspendRunner(options: CreateSuspendRunnerOptions) {
  let hasLoggedFilteredSweepQueryFailure = false;

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

    const settings = options.getCurrentSettings();
    const activity = evaluationOptions.forceTimeoutReached
      ? getSyntheticTimedOutActivity(nowMinute, settings)
      : options.getActivityForTab(tab.id) ?? null;
    const decision = evaluateSuspendDecision(buildPolicyInput(tab, nowMinute, settings, activity, evaluationOptions));

    if (!decision.shouldSuspend) {
      return;
    }

    const payload = buildSuspendPayload(tab, nowMinute);

    if (!payload) {
      options.log("Skipped eligible suspend candidate due missing URL payload.", { tabId: tab.id });
      return;
    }

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

  return {
    runSuspendSweep,
    suspendFromAction,
    appendRecoveryEntryWithCap(entry: RecoveryEntry, currentEntries: RecoveryEntry[]): RecoveryEntry[] {
      return [entry, ...currentEntries].slice(0, MAX_RECOVERY_ENTRIES * 2);
    }
  };
}
