import test from "node:test";
import assert from "node:assert/strict";

import {
  findMatchingSiteProfile,
  isExcludedUrlByHost,
  matchesExcludedHost,
  normalizeExcludedHostEntries,
  normalizeSiteProfileHostRule,
  normalizeSiteProfiles
} from "../build/extension/matcher.js";

test("normalizeExcludedHostEntries canonicalizes exact and wildcard rules", () => {
  const result = normalizeExcludedHostEntries(" Example.com,*.Example.com\nLOCALHOST\nexample.com");

  assert.deepEqual(result, {
    normalizedHosts: ["example.com", "*.example.com", "localhost"],
    ignoredInvalidCount: 0
  });
});

test("normalizeExcludedHostEntries drops malformed entries and reports count", () => {
  const result = normalizeExcludedHostEntries(
    "https://example.com\nexa_mple.com\n*example.com\nexample.com/path\n*.good.com"
  );

  assert.deepEqual(result, {
    normalizedHosts: ["*.good.com"],
    ignoredInvalidCount: 4
  });
});

test("normalizeExcludedHostEntries enforces max entries and host length", () => {
  const tooLong = `${"a".repeat(254)}.com`;
  const result = normalizeExcludedHostEntries(["example.com", "*.example.com", tooLong], {
    maxEntries: 2,
    maxHostLength: 253
  });

  assert.deepEqual(result, {
    normalizedHosts: ["example.com", "*.example.com"],
    ignoredInvalidCount: 0
  });
});

test("matchesExcludedHost supports exact and wildcard subdomain-only semantics", () => {
  const rules = ["example.com", "*.news.example.com"];

  assert.equal(matchesExcludedHost("example.com", rules), true);
  assert.equal(matchesExcludedHost("api.news.example.com", rules), true);
  assert.equal(matchesExcludedHost("news.example.com", rules), false);
  assert.equal(matchesExcludedHost("other.com", rules), false);
});

test("matchesExcludedHost ignores malformed runtime hostnames", () => {
  assert.equal(matchesExcludedHost("not a hostname", ["example.com"]), false);
  assert.equal(matchesExcludedHost("", ["example.com"]), false);
});

test("isExcludedUrlByHost matches by URL hostname regardless of port/path/query", () => {
  assert.equal(
    isExcludedUrlByHost("https://app.example.com:8443/path?q=value#hash", ["*.example.com"]),
    true
  );
  assert.equal(
    isExcludedUrlByHost("https://example.com:8080/path?q=value#hash", ["example.com"]),
    true
  );
});

test("isExcludedUrlByHost returns false for invalid URL payloads", () => {
  assert.equal(isExcludedUrlByHost("not a url", ["example.com"]), false);
  assert.equal(isExcludedUrlByHost(undefined, ["example.com"]), false);
  assert.equal(isExcludedUrlByHost(null, ["example.com"]), false);
});

test("normalizeSiteProfileHostRule validates exact and wildcard rules", () => {
  assert.equal(normalizeSiteProfileHostRule(" Example.com "), "example.com");
  assert.equal(normalizeSiteProfileHostRule("*.Api.Example.com"), "*.api.example.com");
  assert.equal(normalizeSiteProfileHostRule("https://example.com"), null);
});

test("normalizeSiteProfiles keeps valid rows and drops malformed rows", () => {
  const result = normalizeSiteProfiles([
    {
      id: "p1",
      hostRule: "Example.com",
      overrides: {
        idleMinutes: 120,
        skipPinned: false,
        skipAudible: true,
        excludeFromSuspend: false
      }
    },
    {
      id: "",
      hostRule: "bad host",
      overrides: {
        idleMinutes: -1
      }
    }
  ]);

  assert.deepEqual(result, {
    normalizedProfiles: [
      {
        id: "p1",
        hostRule: "example.com",
        overrides: {
          idleMinutes: 120,
          skipPinned: false,
          skipAudible: true,
          excludeFromSuspend: false
        }
      }
    ],
    ignoredInvalidCount: 1
  });
});

test("findMatchingSiteProfile precedence is exact > wildcard > longer target > earliest", () => {
  const profiles = [
    { id: "w1", hostRule: "*.example.com", overrides: {} },
    { id: "w2", hostRule: "*.api.example.com", overrides: {} },
    { id: "e1", hostRule: "api.example.com", overrides: {} },
    { id: "w3", hostRule: "*.api.example.com", overrides: {} }
  ];

  const forApi = findMatchingSiteProfile("api.example.com", profiles);
  const forSub = findMatchingSiteProfile("a.api.example.com", profiles);

  assert.equal(forApi?.id, "e1");
  assert.equal(forSub?.id, "w2");
});
