import test from "node:test";
import assert from "node:assert/strict";
import {
  flushAsyncWork,
  importBackgroundWithMock,
  restoreBackgroundGlobals,
  setNowMinute
} from "./helpers/background-harness.mjs";

const ACTIVITY_STORAGE_KEY = "activityState";

function assertMinutePrecision(records) {
  for (const record of records) {
    assert.equal(Number.isInteger(record.lastActiveAtMinute), true);
    assert.equal(Number.isInteger(record.lastUpdatedAtMinute), true);
  }
}

async function requestSuspendDiagnosticsSnapshot(events, payload = { type: "GET_SUSPEND_DIAGNOSTICS_SNAPSHOT" }) {
  const listener = events.runtimeOnMessage.listeners[0];

  return new Promise((resolve) => {
    const result = listener(payload, {}, (response) => {
      resolve(response);
    });

    if (result !== true) {
      resolve(undefined);
    }
  });
}

test("registers listeners, schedules alarm, and seeds active tabs on startup", { concurrency: false }, async () => {
  setNowMinute(15);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.windowId) {
        return [{ id: 99, windowId: queryInfo.windowId }];
      }

      if (queryInfo.active === true) {
        return [
          { id: 1, windowId: 101 },
          { id: 2, windowId: 202 }
        ];
      }

      return [];
    }
  });
  await backgroundModule.__testing.waitForRuntimeReady();

  assert.equal(events.tabsOnActivated.listeners.length, 1);
  assert.equal(events.tabsOnUpdated.listeners.length, 1);
  assert.equal(events.tabsOnRemoved.listeners.length, 1);
  assert.equal(events.tabsOnReplaced.listeners.length, 1);
  assert.equal(events.windowsOnFocusChanged.listeners.length, 1);
  assert.equal(events.alarmsOnAlarm.listeners.length, 1);
  assert.equal(events.actionOnClicked.listeners.length, 1);
  assert.equal(events.runtimeOnMessage.listeners.length, 1);

  assert.deepEqual(calls.alarmCreateCalls, [
    {
      name: "suspend-sweep-v1",
      alarmInfo: { periodInMinutes: 1 }
    }
  ]);

  const snapshot = backgroundModule.__testing.getActivitySnapshot();
  assert.deepEqual(snapshot, [
    {
      tabId: 1,
      windowId: 101,
      lastActiveAtMinute: 15,
      lastUpdatedAtMinute: 15
    },
    {
      tabId: 2,
      windowId: 202,
      lastActiveAtMinute: 15,
      lastUpdatedAtMinute: 15
    }
  ]);
  assertMinutePrecision(snapshot);
});

test("activation and active-tab updates maintain minute-level activity semantics", { concurrency: false }, async () => {
  setNowMinute(20);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  setNowMinute(21);
  events.tabsOnActivated.dispatch({ tabId: 5, windowId: 500 });

  setNowMinute(25);
  events.tabsOnUpdated.dispatch(5, { status: "complete" }, { windowId: 500, active: true });

  events.tabsOnUpdated.dispatch(-1, { status: "complete" }, { windowId: 500, active: true });

  const snapshot = backgroundModule.__testing.getActivitySnapshot();
  assert.deepEqual(snapshot, [
    {
      tabId: 5,
      windowId: 500,
      lastActiveAtMinute: 25,
      lastUpdatedAtMinute: 25
    }
  ]);
  assertMinutePrecision(snapshot);
  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("runtime diagnostics message returns snapshot and does not mutate tabs", { concurrency: false }, async () => {
  setNowMinute(35);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      return [
        {
          id: 10,
          windowId: 1,
          active: true,
          pinned: false,
          audible: false,
          url: "https://example.com/active",
          title: "Active"
        },
        {
          id: 11,
          windowId: 1,
          active: false,
          pinned: false,
          audible: false,
          url: "https://example.com/idle",
          title: "Idle"
        }
      ];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  const response = await requestSuspendDiagnosticsSnapshot(events);
  assert.equal(response.ok, true);
  assert.equal(response.totalTabs, 2);
  assert.equal(response.entries.length, 2);
  assert.deepEqual(response.summary, {
    active: 1,
    pinned: 0,
    audible: 0,
    internalUrl: 0,
    urlTooLong: 0,
    excludedHost: 0,
    timeoutNotReached: 1,
    eligible: 0
  });
  assert.equal(response.entries[0].reason, "active");
  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("runtime diagnostics message returns failure response when tab query fails", { concurrency: false }, async () => {
  setNowMinute(36);

  const { events, backgroundModule } = await importBackgroundWithMock({
    queryResponder() {
      throw new Error("query failed");
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  const response = await requestSuspendDiagnosticsSnapshot(events);

  assert.deepEqual(response, {
    ok: false,
    message: "Failed to read open tabs for diagnostics."
  });
});

test("inactive tab updates do not reset idle activity timestamps", { concurrency: false }, async () => {
  setNowMinute(26);

  const { events, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  setNowMinute(27);
  events.tabsOnActivated.dispatch({ tabId: 5, windowId: 500 });

  setNowMinute(28);
  events.tabsOnActivated.dispatch({ tabId: 6, windowId: 500 });

  setNowMinute(31);
  events.tabsOnUpdated.dispatch(5, { status: "complete" }, { windowId: 500, active: false });

  const snapshot = backgroundModule.__testing.getActivitySnapshot();
  assert.deepEqual(snapshot, [
    {
      tabId: 5,
      windowId: 500,
      lastActiveAtMinute: 27,
      lastUpdatedAtMinute: 28
    },
    {
      tabId: 6,
      windowId: 500,
      lastActiveAtMinute: 28,
      lastUpdatedAtMinute: 28
    }
  ]);
  assertMinutePrecision(snapshot);
});

test("window focus tracking updates the active tab and ignores WINDOW_ID_NONE", { concurrency: false }, async () => {
  setNowMinute(30);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.windowId === 900) {
        return [{ id: 9, windowId: 900 }];
      }

      return [];
    }
  });
  await backgroundModule.__testing.waitForRuntimeReady();

  backgroundModule.__testing.resetActivityState();
  const queryCallCountBeforeIgnoredFocus = calls.queryCalls.length;

  events.windowsOnFocusChanged.dispatch(-1);
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallCountBeforeIgnoredFocus);

  setNowMinute(31);
  events.windowsOnFocusChanged.dispatch(900);
  await flushAsyncWork();

  const lastQuery = calls.queryCalls.at(-1);
  assert.deepEqual(lastQuery, { active: true, windowId: 900 });

  const snapshot = backgroundModule.__testing.getActivitySnapshot();
  assert.deepEqual(snapshot, [
    {
      tabId: 9,
      windowId: 900,
      lastActiveAtMinute: 31,
      lastUpdatedAtMinute: 31
    }
  ]);
  assertMinutePrecision(snapshot);
});

test("remove and replace events keep activity state bounded", { concurrency: false }, async () => {
  setNowMinute(40);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  setNowMinute(41);
  events.tabsOnActivated.dispatch({ tabId: 11, windowId: 111 });

  events.tabsOnRemoved.dispatch(11);
  assert.deepEqual(backgroundModule.__testing.getActivitySnapshot(), []);

  setNowMinute(42);
  events.tabsOnActivated.dispatch({ tabId: 12, windowId: 222 });

  setNowMinute(43);
  events.tabsOnReplaced.dispatch(13, 12);

  const snapshot = backgroundModule.__testing.getActivitySnapshot();
  assert.deepEqual(snapshot, [
    {
      tabId: 13,
      windowId: 222,
      lastActiveAtMinute: 43,
      lastUpdatedAtMinute: 43
    }
  ]);
  assertMinutePrecision(snapshot);
  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("alarm ticks are cadence-gated and do not sweep every minute", { concurrency: false }, async () => {
  setNowMinute(60);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (queryInfo.active === false) {
        return [];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  const queryCallsAfterStartup = calls.queryCalls.length;

  setNowMinute(60);
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 1);

  setNowMinute(61);
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 1);

  setNowMinute(71);
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 1);

  setNowMinute(72);
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 2);
});

test("settings update can pull sweep due time earlier", { concurrency: false }, async () => {
  setNowMinute(100);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      settings: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 43_200,
          excludedHosts: [],
          skipPinned: true,
          skipAudible: true
        }
      }
    },
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (queryInfo.active === false) {
        return [];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  const queryCallsAfterStartup = calls.queryCalls.length;

  setNowMinute(100);
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 1);

  events.storageOnChanged.dispatch(
    {
      settings: {
        oldValue: {
          schemaVersion: 1,
          settings: {
            idleMinutes: 43_200,
            excludedHosts: [],
            skipPinned: true,
            skipAudible: true
          }
        },
        newValue: {
          schemaVersion: 1,
          settings: {
            idleMinutes: 120,
            excludedHosts: [],
            skipPinned: true,
            skipAudible: true
          }
        }
      }
    },
    "local"
  );

  setNowMinute(101);
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 2);
});

test("alarm sweeps do not overlap while one sweep is in-flight", { concurrency: false }, async () => {
  setNowMinute(200);

  let resolveFirstSweep;
  let firstSweepPending = true;

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (queryInfo.active === false) {
        if (firstSweepPending) {
          firstSweepPending = false;
          return new Promise((resolve) => {
            resolveFirstSweep = () => resolve([]);
          });
        }

        return [];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  const queryCallsAfterStartup = calls.queryCalls.length;

  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 1);

  setNowMinute(230);
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 1);

  resolveFirstSweep();
  await flushAsyncWork();
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 2);
});

test("in-flight sweep catch-up is bounded to one additional run", { concurrency: false }, async () => {
  setNowMinute(220);

  let resolveFirstSweep;
  let firstSweepPending = true;

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (queryInfo.active === false) {
        if (firstSweepPending) {
          firstSweepPending = false;
          return new Promise((resolve) => {
            resolveFirstSweep = () => resolve([]);
          });
        }

        return [];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  const queryCallsAfterStartup = calls.queryCalls.length;

  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 1);

  setNowMinute(233);
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  events.alarmsOnAlarm.dispatch({ name: "suspend-sweep-v1" });
  await flushAsyncWork();
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 1);

  resolveFirstSweep();
  await flushAsyncWork();
  await flushAsyncWork();

  // Initial in-flight sweep + one bounded catch-up sweep.
  assert.equal(calls.queryCalls.length, queryCallsAfterStartup + 2);
});

test("activity persistence coalesces burst updates into a single queued storage write", { concurrency: false }, async () => {
  setNowMinute(300);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  await backgroundModule.__testing.flushPersistedActivityWrites();

  const writesBefore = calls.storageSetCalls.filter((items) =>
    Object.prototype.hasOwnProperty.call(items, ACTIVITY_STORAGE_KEY)
  ).length;

  events.tabsOnActivated.dispatch({ tabId: 1, windowId: 1001 });
  events.tabsOnActivated.dispatch({ tabId: 2, windowId: 1002 });
  events.tabsOnActivated.dispatch({ tabId: 3, windowId: 1003 });

  await backgroundModule.__testing.flushPersistedActivityWrites();

  const writesAfter = calls.storageSetCalls.filter((items) =>
    Object.prototype.hasOwnProperty.call(items, ACTIVITY_STORAGE_KEY)
  ).length;

  assert.equal(writesAfter, writesBefore + 1);
});

test("activity persistence retries transient storage failures and succeeds without a new event", { concurrency: false }, async () => {
  setNowMinute(305);

  let activitySetAttempts = 0;
  let transientFailuresRemaining = 0;
  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSetResponder(items) {
      if (!Object.prototype.hasOwnProperty.call(items, ACTIVITY_STORAGE_KEY)) {
        return;
      }

      activitySetAttempts += 1;

      if (transientFailuresRemaining > 0) {
        transientFailuresRemaining -= 1;
        throw new Error("transient activity write failure");
      }
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  await backgroundModule.__testing.flushPersistedActivityWrites();

  const attemptsBefore = activitySetAttempts;
  transientFailuresRemaining = 2;
  events.tabsOnActivated.dispatch({ tabId: 77, windowId: 7700 });
  await backgroundModule.__testing.flushPersistedActivityWrites();

  assert.equal(activitySetAttempts - attemptsBefore, 3);
  assert.deepEqual(calls.storageData[ACTIVITY_STORAGE_KEY], {
    schemaVersion: 1,
    activity: [
      {
        tabId: 77,
        windowId: 7700,
        lastActiveAtMinute: 305,
        lastUpdatedAtMinute: 305
      }
    ]
  });
});

test("activity persistence gives up after bounded retries until next dirty mark", { concurrency: false }, async () => {
  setNowMinute(306);

  let activitySetAttempts = 0;
  let failWrites = false;
  const { events, backgroundModule } = await importBackgroundWithMock({
    storageSetResponder(items) {
      if (!Object.prototype.hasOwnProperty.call(items, ACTIVITY_STORAGE_KEY)) {
        return;
      }

      activitySetAttempts += 1;

      if (failWrites) {
        throw new Error("permanent activity write failure");
      }
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  await backgroundModule.__testing.flushPersistedActivityWrites();

  const attemptsBefore = activitySetAttempts;
  failWrites = true;
  events.tabsOnActivated.dispatch({ tabId: 78, windowId: 7800 });
  await backgroundModule.__testing.flushPersistedActivityWrites();
  assert.equal(activitySetAttempts - attemptsBefore, 3);

  await flushAsyncWork();
  await flushAsyncWork();
  assert.equal(activitySetAttempts - attemptsBefore, 3);

  events.tabsOnActivated.dispatch({ tabId: 79, windowId: 7900 });
  await backgroundModule.__testing.flushPersistedActivityWrites();
  assert.equal(activitySetAttempts - attemptsBefore, 6);
});

test("persisted activity snapshot remains sorted by tabId", { concurrency: false }, async () => {
  setNowMinute(310);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  await backgroundModule.__testing.flushPersistedActivityWrites();

  events.tabsOnActivated.dispatch({ tabId: 50, windowId: 5000 });
  events.tabsOnActivated.dispatch({ tabId: 3, windowId: 3000 });
  events.tabsOnActivated.dispatch({ tabId: 15, windowId: 1500 });

  await backgroundModule.__testing.flushPersistedActivityWrites();

  assert.deepEqual(calls.storageData[ACTIVITY_STORAGE_KEY], {
    schemaVersion: 1,
    activity: [
      {
        tabId: 3,
        windowId: 3000,
        lastActiveAtMinute: 310,
        lastUpdatedAtMinute: 310
      },
      {
        tabId: 15,
        windowId: 1500,
        lastActiveAtMinute: 310,
        lastUpdatedAtMinute: 310
      },
      {
        tabId: 50,
        windowId: 5000,
        lastActiveAtMinute: 310,
        lastUpdatedAtMinute: 310
      }
    ]
  });
});

test.afterEach(() => {
  restoreBackgroundGlobals();
});
