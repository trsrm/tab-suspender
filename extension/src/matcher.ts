import type { SiteProfile, SiteProfileOverrides } from "./types.js";

const WILDCARD_PREFIX = "*.";

export type ExcludedHostNormalizationOptions = {
  maxEntries?: number;
  maxHostLength?: number;
};

export type ExcludedHostNormalizationResult = {
  normalizedHosts: string[];
  ignoredInvalidCount: number;
};

export type SiteProfileNormalizationOptions = {
  maxEntries?: number;
  maxHostLength?: number;
};

export type SiteProfileNormalizationResult = {
  normalizedProfiles: SiteProfile[];
  ignoredInvalidCount: number;
};

function splitHostEntries(value: string): string[] {
  return value.split(/[\n,]/g);
}

function collectCandidateEntries(value: unknown): string[] | null {
  if (typeof value === "string") {
    return splitHostEntries(value);
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const candidates: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    candidates.push(...splitHostEntries(entry));
  }

  return candidates;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidHostnameLabel(label: string): boolean {
  if (label.length === 0 || label.length > 63) {
    return false;
  }

  if (!/^[a-z0-9-]+$/.test(label)) {
    return false;
  }

  return !label.startsWith("-") && !label.endsWith("-");
}

function isValidDnsHostname(hostname: string): boolean {
  if (hostname === "localhost") {
    return true;
  }

  if (!/^[a-z0-9.-]+$/.test(hostname)) {
    return false;
  }

  if (hostname.startsWith(".") || hostname.endsWith(".")) {
    return false;
  }

  const labels = hostname.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every(isValidHostnameLabel);
}

function normalizeHostRule(entry: string, maxHostLength: number): string | null {
  const normalized = entry.trim().toLowerCase();

  if (normalized.length === 0 || normalized.length > maxHostLength) {
    return null;
  }

  if (normalized.includes("*")) {
    if (!normalized.startsWith(WILDCARD_PREFIX) || normalized.indexOf("*", WILDCARD_PREFIX.length) !== -1) {
      return null;
    }

    const wildcardTarget = normalized.slice(WILDCARD_PREFIX.length);

    if (!isValidDnsHostname(wildcardTarget)) {
      return null;
    }

    return `${WILDCARD_PREFIX}${wildcardTarget}`;
  }

  if (!isValidDnsHostname(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeRuntimeHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase().replace(/\.+$/g, "");

  if (normalized.length === 0) {
    return null;
  }

  return isValidDnsHostname(normalized) ? normalized : null;
}

function normalizeSiteProfileOverrides(value: unknown): SiteProfileOverrides {
  const overrides: SiteProfileOverrides = {};

  if (!isRecord(value)) {
    return overrides;
  }

  if (typeof value.idleMinutes === "number" && Number.isInteger(value.idleMinutes) && value.idleMinutes > 0) {
    overrides.idleMinutes = value.idleMinutes;
  }

  if (typeof value.skipPinned === "boolean") {
    overrides.skipPinned = value.skipPinned;
  }

  if (typeof value.skipAudible === "boolean") {
    overrides.skipAudible = value.skipAudible;
  }

  if (typeof value.excludeFromSuspend === "boolean") {
    overrides.excludeFromSuspend = value.excludeFromSuspend;
  }

  return overrides;
}

function isValidProfileId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getHostRuleTargetLength(hostRule: string): number {
  return hostRule.startsWith(WILDCARD_PREFIX) ? hostRule.length - WILDCARD_PREFIX.length : hostRule.length;
}

function isWildcardRule(hostRule: string): boolean {
  return hostRule.startsWith(WILDCARD_PREFIX);
}

export function normalizeSiteProfileHostRule(value: unknown, maxHostLength = Number.POSITIVE_INFINITY): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return normalizeHostRule(value, maxHostLength);
}

export function normalizeExcludedHostEntries(
  value: unknown,
  options: ExcludedHostNormalizationOptions = {}
): ExcludedHostNormalizationResult {
  const candidates = collectCandidateEntries(value);

  if (!candidates) {
    return {
      normalizedHosts: [],
      ignoredInvalidCount: 0
    };
  }

  const maxEntries = options.maxEntries ?? Number.POSITIVE_INFINITY;
  const maxHostLength = options.maxHostLength ?? Number.POSITIVE_INFINITY;
  const normalizedHosts: string[] = [];
  const seen = new Set<string>();
  let ignoredInvalidCount = 0;

  for (const candidate of candidates) {
    const normalizedRule = normalizeHostRule(candidate, maxHostLength);

    if (!normalizedRule) {
      if (candidate.trim().length > 0) {
        ignoredInvalidCount += 1;
      }

      continue;
    }

    if (seen.has(normalizedRule)) {
      continue;
    }

    seen.add(normalizedRule);
    normalizedHosts.push(normalizedRule);

    if (normalizedHosts.length >= maxEntries) {
      break;
    }
  }

  return {
    normalizedHosts,
    ignoredInvalidCount
  };
}

export function normalizeSiteProfiles(
  value: unknown,
  options: SiteProfileNormalizationOptions = {}
): SiteProfileNormalizationResult {
  if (!Array.isArray(value)) {
    return {
      normalizedProfiles: [],
      ignoredInvalidCount: 0
    };
  }

  const maxEntries = options.maxEntries ?? Number.POSITIVE_INFINITY;
  const maxHostLength = options.maxHostLength ?? Number.POSITIVE_INFINITY;
  const normalizedProfiles: SiteProfile[] = [];
  let ignoredInvalidCount = 0;

  for (const rawEntry of value) {
    if (!isRecord(rawEntry)) {
      ignoredInvalidCount += 1;
      continue;
    }

    const id = isValidProfileId(rawEntry.id) ? rawEntry.id.trim() : null;
    const hostRule = normalizeSiteProfileHostRule(rawEntry.hostRule, maxHostLength);

    if (!id || !hostRule) {
      ignoredInvalidCount += 1;
      continue;
    }

    const overrides = normalizeSiteProfileOverrides(rawEntry.overrides);
    normalizedProfiles.push({ id, hostRule, overrides });

    if (normalizedProfiles.length >= maxEntries) {
      break;
    }
  }

  return {
    normalizedProfiles,
    ignoredInvalidCount
  };
}

export function matchesExcludedHost(hostname: string, excludedHosts: string[]): boolean {
  const normalizedHost = normalizeRuntimeHostname(hostname);

  if (!normalizedHost) {
    return false;
  }

  for (const rule of excludedHosts) {
    if (rule.startsWith(WILDCARD_PREFIX)) {
      const wildcardTarget = rule.slice(WILDCARD_PREFIX.length);

      if (normalizedHost.length <= wildcardTarget.length) {
        continue;
      }

      if (normalizedHost.endsWith(`.${wildcardTarget}`)) {
        return true;
      }

      continue;
    }

    if (normalizedHost === rule) {
      return true;
    }
  }

  return false;
}

export function isExcludedUrlByHost(url: string | null | undefined, excludedHosts: string[]): boolean {
  if (typeof url !== "string" || url.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return matchesExcludedHost(parsed.hostname, excludedHosts);
  } catch {
    return false;
  }
}

export function findMatchingSiteProfile(hostname: string, siteProfiles: SiteProfile[]): SiteProfile | null {
  const normalizedHost = normalizeRuntimeHostname(hostname);

  if (!normalizedHost || siteProfiles.length === 0) {
    return null;
  }

  let bestIndex = -1;
  let bestProfile: SiteProfile | null = null;

  for (let index = 0; index < siteProfiles.length; index += 1) {
    const profile = siteProfiles[index];

    if (!matchesExcludedHost(normalizedHost, [profile.hostRule])) {
      continue;
    }

    if (!bestProfile) {
      bestProfile = profile;
      bestIndex = index;
      continue;
    }

    const bestIsWildcard = isWildcardRule(bestProfile.hostRule);
    const candidateIsWildcard = isWildcardRule(profile.hostRule);

    if (bestIsWildcard !== candidateIsWildcard) {
      if (!candidateIsWildcard) {
        bestProfile = profile;
        bestIndex = index;
      }
      continue;
    }

    const bestTargetLength = getHostRuleTargetLength(bestProfile.hostRule);
    const candidateTargetLength = getHostRuleTargetLength(profile.hostRule);

    if (candidateTargetLength > bestTargetLength) {
      bestProfile = profile;
      bestIndex = index;
      continue;
    }

    if (candidateTargetLength < bestTargetLength) {
      continue;
    }

    if (index < bestIndex) {
      bestProfile = profile;
      bestIndex = index;
    }
  }

  return bestProfile;
}
