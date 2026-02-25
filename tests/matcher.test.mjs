import test from "node:test";
import assert from "node:assert/strict";

import {
  isExcludedUrlByHost,
  matchesExcludedHost,
  normalizeExcludedHostEntries
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
