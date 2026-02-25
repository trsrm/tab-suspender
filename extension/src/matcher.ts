const WILDCARD_PREFIX = "*.";

export type ExcludedHostNormalizationOptions = {
  maxEntries?: number;
  maxHostLength?: number;
};

export type ExcludedHostNormalizationResult = {
  normalizedHosts: string[];
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

function normalizeRule(entry: string, maxHostLength: number): string | null {
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
    const normalizedRule = normalizeRule(candidate, maxHostLength);

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
