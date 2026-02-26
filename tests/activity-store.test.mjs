import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ACTIVITY_STORE_MODULE_PATH = path.resolve("build/extension/activity-store.js");

async function importActivityStore() {
  const moduleUrl = `${pathToFileURL(ACTIVITY_STORE_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
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
      storedValue = items.activityState;

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

test("decodeStoredActivityState returns empty array for null and schema mismatch", async () => {
  const activityStore = await importActivityStore();

  assert.deepEqual(activityStore.decodeStoredActivityState(null), []);
  assert.deepEqual(activityStore.decodeStoredActivityState({ schemaVersion: 2, activity: [] }), []);
});

test("decodeStoredActivityState sanitizes, dedupes, and normalizes timestamps", async () => {
  const activityStore = await importActivityStore();

  const decoded = activityStore.decodeStoredActivityState({
    schemaVersion: 1,
    activity: [
      { tabId: 9, windowId: 2, lastActiveAtMinute: 20, lastUpdatedAtMinute: 25 },
      { tabId: 3, windowId: "bad", lastActiveAtMinute: 50, lastUpdatedAtMinute: 40 },
      { tabId: 9, windowId: 1, lastActiveAtMinute: 21, lastUpdatedAtMinute: 26 },
      { tabId: -1, windowId: 1, lastActiveAtMinute: 1, lastUpdatedAtMinute: 1 }
    ]
  });

  assert.deepEqual(decoded, [
    { tabId: 3, windowId: -1, lastActiveAtMinute: 50, lastUpdatedAtMinute: 50 },
    { tabId: 9, windowId: 1, lastActiveAtMinute: 21, lastUpdatedAtMinute: 26 }
  ]);
});

test("saveActivityToStorage enforces cap and stores sorted envelope", async () => {
  const activityStore = await importActivityStore();
  const storageArea = createStorageArea();

  const records = Array.from({ length: activityStore.MAX_ACTIVITY_RECORDS + 10 }, (_, index) => ({
    tabId: index,
    windowId: index,
    lastActiveAtMinute: index,
    lastUpdatedAtMinute: index
  }));

  const saved = await activityStore.saveActivityToStorage(records, storageArea);

  assert.equal(saved.activity.length, activityStore.MAX_ACTIVITY_RECORDS);
  assert.equal(saved.activity[0].tabId, 0);
  assert.equal(saved.activity.at(-1).tabId, activityStore.MAX_ACTIVITY_RECORDS - 1);
  assert.deepEqual(storageArea.read(), saved);
});

test("loadActivityFromStorage returns decoded activity", async () => {
  const activityStore = await importActivityStore();
  const storageArea = createStorageArea({
    schemaVersion: 1,
    activity: [{ tabId: 7, windowId: 10, lastActiveAtMinute: 2, lastUpdatedAtMinute: 3 }]
  });

  const loaded = await activityStore.loadActivityFromStorage(storageArea);

  assert.deepEqual(loaded, [{ tabId: 7, windowId: 10, lastActiveAtMinute: 2, lastUpdatedAtMinute: 3 }]);
});
