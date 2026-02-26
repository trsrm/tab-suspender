import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PORTABLE_CONFIG_MODULE_PATH = path.resolve("build/extension/portable-config.js");

async function importPortableConfig() {
  const moduleUrl = `${pathToFileURL(PORTABLE_CONFIG_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

test("serializePortableConfig writes deterministic root keys", async () => {
  const portableConfig = await importPortableConfig();

  const serialized = portableConfig.serializePortableConfig({
    exportSchemaVersion: 1,
    generatedAtMinute: 123,
    settings: {
      idleMinutes: 60,
      excludedHosts: ["example.com"],
      skipPinned: true,
      skipAudible: true,
      siteProfiles: []
    },
    recoveryState: {
      schemaVersion: 1,
      entries: []
    }
  });

  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.includes('"exportSchemaVersion": 1'), true);
  assert.equal(serialized.indexOf('"exportSchemaVersion"') < serialized.indexOf('"generatedAtMinute"'), true);
  assert.equal(serialized.indexOf('"generatedAtMinute"') < serialized.indexOf('"settings"'), true);
  assert.equal(serialized.indexOf('"settings"') < serialized.indexOf('"recoveryState"'), true);
});

test("parsePortableConfigJson rejects malformed json", async () => {
  const portableConfig = await importPortableConfig();
  const parsed = await portableConfig.parsePortableConfigJson("{bad json");

  assert.deepEqual(parsed, {
    ok: false,
    code: "invalidJson",
    message: "Invalid JSON file."
  });
});

test("parsePortableConfigJson rejects unsupported export schema version", async () => {
  const portableConfig = await importPortableConfig();
  const parsed = await portableConfig.parsePortableConfigJson(
    JSON.stringify({
      exportSchemaVersion: 99,
      generatedAtMinute: 10,
      settings: {},
      recoveryState: {
        schemaVersion: 1,
        entries: []
      }
    })
  );

  assert.deepEqual(parsed, {
    ok: false,
    code: "unsupportedExportSchemaVersion",
    message: "Unsupported export schema version."
  });
});

test("parsePortableConfigJson sanitizes payload and reports ignored invalid counts", async () => {
  const portableConfig = await importPortableConfig();
  const parsed = await portableConfig.parsePortableConfigJson(
    JSON.stringify({
      exportSchemaVersion: 1,
      generatedAtMinute: 50,
      settings: {
        idleMinutes: 30,
        excludedHosts: ["Example.COM", "bad host", "*.news.example.com", "*.news.example.com"],
        skipPinned: false,
        skipAudible: true,
        siteProfiles: [
          {
            id: "profile-1",
            hostRule: " API.EXAMPLE.COM ",
            overrides: {
              idleMinutes: 120,
              skipPinned: false,
              skipAudible: true,
              excludeFromSuspend: true
            }
          },
          {
            id: "",
            hostRule: "bad host",
            overrides: {
              idleMinutes: 1
            }
          }
        ]
      },
      recoveryState: {
        schemaVersion: 1,
        entries: [
          { url: "https://example.com/a", title: "A", suspendedAtMinute: 10 },
          { url: "https://example.com/a", title: "A2", suspendedAtMinute: 11 },
          { url: "chrome://settings", title: "Invalid", suspendedAtMinute: 12 }
        ]
      },
      unknownFutureField: true
    })
  );

  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }

  assert.deepEqual(parsed.config, {
    exportSchemaVersion: 1,
    generatedAtMinute: 50,
    settings: {
      idleMinutes: 60,
      excludedHosts: ["example.com", "*.news.example.com"],
      skipPinned: false,
      skipAudible: true,
      siteProfiles: [
        {
          id: "profile-1",
          hostRule: "api.example.com",
          overrides: {
            idleMinutes: 120,
            skipPinned: false,
            skipAudible: true,
            excludeFromSuspend: true
          }
        }
      ]
    },
    recoveryState: {
      schemaVersion: 1,
      entries: [{ url: "https://example.com/a", title: "A2", suspendedAtMinute: 11 }]
    }
  });

  assert.deepEqual(parsed.preview, {
    exportSchemaVersion: 1,
    generatedAtMinute: 50,
    counts: {
      excludedHosts: 2,
      siteProfiles: 1,
      recoveryEntries: 1
    },
    ignoredInvalid: {
      excludedHosts: 1,
      siteProfiles: 1,
      recoveryEntries: 1
    }
  });
});
