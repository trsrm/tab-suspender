import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const REQUIRED_PATHS = [
  "ROADMAP.md",
  "README.md",
  "docs/architecture.md",
  "docs/qa-checklist.md",
  "extension/manifest.json",
  "extension/background.js",
  "extension/options.html",
  "extension/options.js",
  "extension/suspended.html",
  "extension/suspended.js",
  "extension/src/background.ts",
  "extension/src/options.ts",
  "extension/src/suspended.ts",
  "extension/src/types.ts"
];

test("scaffold required paths exist", () => {
  for (const path of REQUIRED_PATHS) {
    assert.equal(fs.existsSync(path), true, `Missing required scaffold path: ${path}`);
  }
});

test("manifest baseline permissions are least privilege", () => {
  const raw = fs.readFileSync("extension/manifest.json", "utf8");
  const manifest = JSON.parse(raw);

  assert.deepEqual(manifest.permissions, ["tabs", "storage", "alarms"]);
  assert.equal(manifest.manifest_version, 3);
  assert.equal(typeof manifest.content_security_policy.extension_pages, "string");
});
