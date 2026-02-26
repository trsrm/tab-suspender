import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SETTINGS_STORE_MODULE_PATH = path.resolve("build/extension/settings-store.js");

async function importSettingsStore() {
  const moduleUrl = `${pathToFileURL(SETTINGS_STORE_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

function createStorageArea(seedValue = undefined) {
  let storedValue = seedValue;

  return {
    get(key, callback) {
      const result = { [key]: storedValue };

      return Promise.resolve().then(() => {
        if (callback) {
          callback(result);
        }

        return result;
      });
    },
    set(items, callback) {
      storedValue = items.settings;

      return Promise.resolve().then(() => {
        if (callback) {
          callback();
        }
      });
    },
    read() {
      return storedValue;
    }
  };
}

test("decodeStoredSettings returns defaults for null and schema mismatch", async () => {
  const settingsStore = await importSettingsStore();

  assert.deepEqual(settingsStore.decodeStoredSettings(null), settingsStore.DEFAULT_SETTINGS);
  assert.deepEqual(
    settingsStore.decodeStoredSettings({ schemaVersion: 2, settings: { idleMinutes: 60 } }),
    settingsStore.DEFAULT_SETTINGS
  );
});

test("decodeStoredSettings sanitizes and clamps invalid values", async () => {
  const settingsStore = await importSettingsStore();

  const decoded = settingsStore.decodeStoredSettings({
    schemaVersion: 1,
    settings: {
      idleMinutes: "999999",
      excludedHosts: " Example.com\n*.news.example.com\nhttps://invalid.example\nexample.com",
      skipPinned: "nope",
      skipAudible: false
    }
  });

  assert.deepEqual(decoded, {
    idleMinutes: settingsStore.MAX_IDLE_MINUTES,
    excludedHosts: ["example.com", "*.news.example.com"],
    skipPinned: true,
    skipAudible: false
  });
});

test("saveSettingsToStorage writes versioned sanitized envelope", async () => {
  const settingsStore = await importSettingsStore();
  const storageArea = createStorageArea();

  const saved = await settingsStore.saveSettingsToStorage(
    {
      idleMinutes: 10,
      excludedHosts: ["Example.COM", "bad host", "*.news.example.com"],
      skipPinned: false,
      skipAudible: "invalid"
    },
    storageArea
  );

  assert.deepEqual(saved, {
    schemaVersion: 1,
    settings: {
      idleMinutes: settingsStore.MIN_IDLE_MINUTES,
      excludedHosts: ["example.com", "*.news.example.com"],
      skipPinned: false,
      skipAudible: true
    }
  });
  assert.deepEqual(storageArea.read(), saved);
});

test("loadSettingsFromStorage returns decoded settings", async () => {
  const settingsStore = await importSettingsStore();
  const storageArea = createStorageArea({
    schemaVersion: 1,
    settings: {
      idleMinutes: 60,
      excludedHosts: ["example.com"],
      skipPinned: false,
      skipAudible: true
    }
  });

  const loaded = await settingsStore.loadSettingsFromStorage(storageArea);

  assert.deepEqual(loaded, {
    idleMinutes: 60,
    excludedHosts: ["example.com"],
    skipPinned: false,
    skipAudible: true
  });
});
