import type { PolicyEvaluatorInput, SuspendDecision } from "./types.js";

const SUSPENDABLE_PROTOCOLS = new Set(["http:", "https:"]);

function shouldSkipPinned(input: PolicyEvaluatorInput): boolean {
  return input.settings.skipPinned && input.tab.pinned;
}

function shouldSkipAudible(input: PolicyEvaluatorInput): boolean {
  return input.settings.skipAudible && input.tab.audible;
}

function shouldSkipUrlTooLong(input: PolicyEvaluatorInput): boolean {
  return input.flags?.urlTooLong === true;
}

function shouldSkipExcludedHost(input: PolicyEvaluatorInput): boolean {
  return input.flags?.excludedHost === true;
}

function shouldSkipInternalUrl(input: PolicyEvaluatorInput): boolean {
  if (typeof input.flags?.internalUrl === "boolean") {
    return input.flags.internalUrl;
  }

  return isInternalUrl(input.tab.url);
}

function getReferenceMinute(input: PolicyEvaluatorInput): number | null {
  if (!input.activity) {
    return null;
  }

  return Math.max(input.activity.lastActiveAtMinute, input.activity.lastUpdatedAtMinute);
}

function timeoutReached(input: PolicyEvaluatorInput, referenceMinute: number): boolean {
  return input.nowMinute - referenceMinute >= input.settings.idleMinutes;
}

export function isInternalUrl(url?: string | null): boolean {
  if (typeof url !== "string" || url.trim().length === 0) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);
    return !SUSPENDABLE_PROTOCOLS.has(parsedUrl.protocol.toLowerCase());
  } catch {
    return true;
  }
}

export function evaluateSuspendDecision(input: PolicyEvaluatorInput): SuspendDecision {
  if (input.tab.active) {
    return { shouldSuspend: false, reason: "active" };
  }

  if (shouldSkipPinned(input)) {
    return { shouldSuspend: false, reason: "pinned" };
  }

  if (shouldSkipAudible(input)) {
    return { shouldSuspend: false, reason: "audible" };
  }

  if (shouldSkipInternalUrl(input)) {
    return { shouldSuspend: false, reason: "internalUrl" };
  }

  if (shouldSkipUrlTooLong(input)) {
    return { shouldSuspend: false, reason: "urlTooLong" };
  }

  if (shouldSkipExcludedHost(input)) {
    return { shouldSuspend: false, reason: "excludedHost" };
  }

  const referenceMinute = getReferenceMinute(input);

  if (referenceMinute === null || !timeoutReached(input, referenceMinute)) {
    return { shouldSuspend: false, reason: "timeoutNotReached" };
  }

  return { shouldSuspend: true, reason: "eligible" };
}
