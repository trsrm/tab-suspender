import test from "node:test";
import assert from "node:assert/strict";
import {
  flushAsyncWork,
  importBackgroundWithMock,
  restoreBackgroundGlobals,
  setNowMinute
} from "./helpers/background-harness.mjs";

function assertMinutePrecision(records) {
  for (const record of records) {
    assert.equal(Number.isInteger(record.lastActiveAtMinute), true);
    assert.equal(Number.isInteger(record.lastUpdatedAtMinute), true);
  }
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

  assert.equal(events.tabsOnActivated.listeners.length, 1);
  assert.equal(events.tabsOnUpdated.listeners.length, 1);
  assert.equal(events.tabsOnRemoved.listeners.length, 1);
  assert.equal(events.tabsOnReplaced.listeners.length, 1);
  assert.equal(events.windowsOnFocusChanged.listeners.length, 1);
  assert.equal(events.runtimeOnMessage.listeners.length, 1);
  assert.equal(events.alarmsOnAlarm.listeners.length, 1);
  assert.equal(events.actionOnClicked.listeners.length, 1);

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

test("activation and update events maintain minute-level activity semantics", { concurrency: false }, async () => {
  setNowMinute(20);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  backgroundModule.__testing.resetActivityState();

  setNowMinute(21);
  events.tabsOnActivated.dispatch({ tabId: 5, windowId: 500 });

  setNowMinute(25);
  events.tabsOnUpdated.dispatch(5, {}, { windowId: 500 });

  events.tabsOnUpdated.dispatch(-1, {}, { windowId: 500 });

  const snapshot = backgroundModule.__testing.getActivitySnapshot();
  assert.deepEqual(snapshot, [
    {
      tabId: 5,
      windowId: 500,
      lastActiveAtMinute: 21,
      lastUpdatedAtMinute: 25
    }
  ]);
  assertMinutePrecision(snapshot);
  assert.equal(calls.tabsUpdateCalls.length, 0);
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

test("PING response remains unchanged", { concurrency: false }, async () => {
  setNowMinute(50);

  const { events, backgroundModule } = await importBackgroundWithMock();
  backgroundModule.__testing.resetActivityState();

  let response;
  events.runtimeOnMessage.dispatch({ type: "PING" }, { id: "test-sender" }, (payload) => {
    response = payload;
  });

  assert.deepEqual(response, { ok: true, phase: "skeleton" });
});

test.afterEach(() => {
  restoreBackgroundGlobals();
});
