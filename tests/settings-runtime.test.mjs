import test from "node:test";
import assert from "node:assert/strict";
import {
  flushAsyncWork,
  importBackgroundWithMock,
  restoreBackgroundGlobals,
  setNowMinute
} from "./helpers/background-harness.mjs";

const SETTINGS_STORAGE_KEY = "settings";
const ACTIVITY_STORAGE_KEY = "activityState";

function isSweepCandidateQuery(queryInfo) {
  return queryInfo && queryInfo.active === false;
}

function createDeferred() {
  let resolve;

  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve
  };
}

test("background uses persisted settings for sweep decisions", { concurrency: false }, async () => {
  setNowMinute(1);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 60,
          excludedHosts: [],
          skipPinned: false,
          skipAudible: true
        }
      }
    },
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (isSweepCandidateQuery(queryInfo)) {
        return [
          {
            id: 91,
            windowId: 8,
            active: false,
            pinned: true,
            audible: false,
            url: "https://example.com/pinned"
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  setNowMinute(1);
  events.tabsOnActivated.dispatch({ tabId: 91, windowId: 8 });

  setNowMinute(70);
  await backgroundModule.__testing.runSuspendSweep(70);

  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(backgroundModule.__testing.getCurrentSettings().idleMinutes, 60);
  assert.equal(backgroundModule.__testing.getCurrentSettings().skipPinned, false);
});

test("storage.onChanged updates runtime settings without restart", { concurrency: false }, async () => {
  setNowMinute(2);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (isSweepCandidateQuery(queryInfo)) {
        return [
          {
            id: 92,
            windowId: 9,
            active: false,
            pinned: true,
            audible: false,
            url: "https://example.com/live"
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.tabsOnActivated.dispatch({ tabId: 92, windowId: 9 });

  setNowMinute(70);
  await backgroundModule.__testing.runSuspendSweep(70);
  assert.equal(calls.tabsUpdateCalls.length, 0);

  events.storageOnChanged.dispatch(
    {
      [SETTINGS_STORAGE_KEY]: {
        oldValue: undefined,
        newValue: {
          schemaVersion: 1,
          settings: {
            idleMinutes: 60,
            excludedHosts: [],
            skipPinned: false,
            skipAudible: true
          }
        }
      }
    },
    "local"
  );

  setNowMinute(71);
  await backgroundModule.__testing.runSuspendSweep(71);

  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(backgroundModule.__testing.getCurrentSettings().skipPinned, false);
});

test("storage.onChanged wins over stale hydration when updates interleave", { concurrency: false }, async () => {
  setNowMinute(2);

  const hydrateGate = createDeferred();
  const staleHydrationPayload = {
    [SETTINGS_STORAGE_KEY]: {
      schemaVersion: 1,
      settings: {
        idleMinutes: 999,
        excludedHosts: [],
        skipPinned: true,
        skipAudible: true
      }
    }
  };

  const { events, backgroundModule } = await importBackgroundWithMock({
    storageGetResponder(key, defaultResult) {
      if (key === SETTINGS_STORAGE_KEY) {
        return hydrateGate.promise.then(() => staleHydrationPayload);
      }

      return defaultResult;
    }
  });

  events.storageOnChanged.dispatch(
    {
      [SETTINGS_STORAGE_KEY]: {
        oldValue: undefined,
        newValue: {
          schemaVersion: 1,
          settings: {
            idleMinutes: 60,
            excludedHosts: [],
            skipPinned: false,
            skipAudible: true
          }
        }
      }
    },
    "local"
  );

  assert.equal(backgroundModule.__testing.getCurrentSettings().skipPinned, false);
  hydrateGate.resolve();
  await backgroundModule.__testing.waitForRuntimeReady();
  await flushAsyncWork();

  assert.deepEqual(backgroundModule.__testing.getCurrentSettings(), {
    idleMinutes: 60,
    excludedHosts: [],
    skipPinned: false,
    skipAudible: true
  });
});

test("invalid stored payload falls back to default settings", { concurrency: false }, async () => {
  setNowMinute(3);

  const { backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 2,
        settings: {
          idleMinutes: 5,
          excludedHosts: ["example.com"],
          skipPinned: false,
          skipAudible: false
        }
      }
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();

  assert.deepEqual(backgroundModule.__testing.getCurrentSettings(), {
    idleMinutes: 1440,
    excludedHosts: [],
    skipPinned: true,
    skipAudible: true
  });
});

test("persisted excluded hosts prevent sweep suspend for exact match", { concurrency: false }, async () => {
  setNowMinute(4);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 60,
          excludedHosts: ["example.com", "*.news.example.com"],
          skipPinned: true,
          skipAudible: true
        }
      }
    },
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (isSweepCandidateQuery(queryInfo)) {
        return [
          {
            id: 93,
            windowId: 10,
            active: false,
            pinned: false,
            audible: false,
            url: "https://example.com/excluded-exact"
          },
          {
            id: 94,
            windowId: 10,
            active: false,
            pinned: false,
            audible: false,
            url: "https://api.news.example.com/excluded-wildcard"
          },
          {
            id: 95,
            windowId: 10,
            active: false,
            pinned: false,
            audible: false,
            url: "https://allowed.example.net/eligible"
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.tabsOnActivated.dispatch({ tabId: 93, windowId: 10 });
  events.tabsOnActivated.dispatch({ tabId: 94, windowId: 10 });
  events.tabsOnActivated.dispatch({ tabId: 95, windowId: 10 });

  setNowMinute(70);
  await backgroundModule.__testing.runSuspendSweep(70);

  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(calls.tabsUpdateCalls[0][0], 95);
});

test("invalid stored activity payload falls back to empty activity state", { concurrency: false }, async () => {
  setNowMinute(5);

  const { backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [ACTIVITY_STORAGE_KEY]: {
        schemaVersion: 2,
        activity: [
          {
            tabId: 1,
            windowId: 1,
            lastActiveAtMinute: 1,
            lastUpdatedAtMinute: 1
          }
        ]
      }
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  assert.deepEqual(backgroundModule.__testing.getActivitySnapshot(), []);
});

test.afterEach(() => {
  restoreBackgroundGlobals();
});
