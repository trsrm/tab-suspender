import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const REQUIRED_PATHS = [
  "ROADMAP.md",
  "README.md",
  "docs/architecture.md",
  "docs/qa-checklist.md",
  "extension/manifest.json",
  "extension/icons/icon-16.png",
  "extension/icons/icon-32.png",
  "extension/icons/icon-48.png",
  "extension/icons/icon-128.png",
  "extension/options.html",
  "extension/suspended.html",
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

test("manifest includes extension and action icon mappings", () => {
  const raw = fs.readFileSync("extension/manifest.json", "utf8");
  const manifest = JSON.parse(raw);

  assert.deepEqual(manifest.icons, {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png"
  });
  assert.deepEqual(manifest.action.default_icon, {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png"
  });
});
