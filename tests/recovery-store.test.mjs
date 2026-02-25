import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RECOVERY_STORE_MODULE_PATH = path.resolve("build/extension/recovery-store.js");

async function importRecoveryStore() {
  const moduleUrl = `${pathToFileURL(RECOVERY_STORE_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
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
      storedValue = items.recoveryState;

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

test("decodeStoredRecoveryState returns empty array for unknown schema", async () => {
  const recoveryStore = await importRecoveryStore();

  assert.deepEqual(recoveryStore.decodeStoredRecoveryState({ schemaVersion: 2, entries: [] }), []);
  assert.deepEqual(recoveryStore.decodeStoredRecoveryState(null), []);
});

test("decodeStoredRecoveryState sanitizes, dedupes, and sorts by most recent minute", async () => {
  const recoveryStore = await importRecoveryStore();

  const decoded = recoveryStore.decodeStoredRecoveryState({
    schemaVersion: 1,
    entries: [
      { url: "https://example.com/a", title: "Old A", suspendedAtMinute: 10 },
      { url: "not a url", title: "Invalid", suspendedAtMinute: 99 },
      { url: "https://example.com/a", title: "New A", suspendedAtMinute: 11 },
      { url: "https://example.com/b", title: "B", suspendedAtMinute: 12 }
    ]
  });

  assert.deepEqual(decoded, [
    { url: "https://example.com/b", title: "B", suspendedAtMinute: 12 },
    { url: "https://example.com/a", title: "New A", suspendedAtMinute: 11 }
  ]);
});

test("saveRecoveryToStorage writes versioned sanitized envelope", async () => {
  const recoveryStore = await importRecoveryStore();
  const storageArea = createStorageArea();

  const saved = await recoveryStore.saveRecoveryToStorage(
    [
      { url: "https://example.com/a", title: "A", suspendedAtMinute: 10 },
      { url: "https://example.com/a", title: "A newer", suspendedAtMinute: 11 },
      { url: "chrome://settings", title: "Invalid protocol", suspendedAtMinute: 12 }
    ],
    storageArea
  );

  assert.deepEqual(saved, {
    schemaVersion: 1,
    entries: [{ url: "https://example.com/a", title: "A newer", suspendedAtMinute: 11 }]
  });
  assert.deepEqual(storageArea.read(), saved);
});

test("loadRecoveryFromStorage returns decoded recovery entries", async () => {
  const recoveryStore = await importRecoveryStore();
  const storageArea = createStorageArea({
    schemaVersion: 1,
    entries: [{ url: "https://example.com/c", title: "C", suspendedAtMinute: 20 }]
  });

  const loaded = await recoveryStore.loadRecoveryFromStorage(storageArea);

  assert.deepEqual(loaded, [{ url: "https://example.com/c", title: "C", suspendedAtMinute: 20 }]);
});
