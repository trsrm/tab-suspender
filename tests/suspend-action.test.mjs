import test from "node:test";
import assert from "node:assert/strict";
import {
  flushAsyncWork,
  importBackgroundWithMock,
  restoreBackgroundGlobals,
  setNowMinute
} from "./helpers/background-harness.mjs";

const TOO_LONG_URL = `https://example.com/${"a".repeat(2100)}`;
const SETTINGS_STORAGE_KEY = "settings";
const ACTIVITY_STORAGE_KEY = "activityState";

function decodePayloadFromUpdateCall(updateCall) {
  const [, updateProperties] = updateCall;
  const destination = new URL(updateProperties.url);

  return {
    destination,
    u: destination.searchParams.get("u"),
    t: destination.searchParams.get("t"),
    ts: destination.searchParams.get("ts")
  };
}

test("runSuspendSweep suspends eligible idle tab with encoded payload", { concurrency: false }, async () => {
  setNowMinute(1);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (Object.keys(queryInfo).length === 0) {
        return [
          {
            id: 42,
            windowId: 7,
            active: false,
            pinned: false,
            audible: false,
            url: "https://example.com/page?x=1",
            title: "  Example Tab  "
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  events.tabsOnActivated.dispatch({ tabId: 42, windowId: 7 });

  setNowMinute(70);
  await backgroundModule.__testing.runSuspendSweep(70);

  assert.equal(calls.tabsUpdateCalls.length, 1);

  const payload = decodePayloadFromUpdateCall(calls.tabsUpdateCalls[0]);
  assert.equal(payload.destination.pathname, "/suspended.html");
  assert.equal(payload.u, "https://example.com/page?x=1");
  assert.equal(payload.t, "Example Tab");
  assert.equal(payload.ts, "70");
});

test("runSuspendSweep skips active, pinned, audible, internal, invalid-id, and missing-url tabs", { concurrency: false }, async () => {
  setNowMinute(80);

  const { calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (Object.keys(queryInfo).length === 0) {
        return [
          { id: 1, active: true, pinned: false, audible: false, url: "https://example.com/active" },
          { id: 2, active: false, pinned: true, audible: false, url: "https://example.com/pinned" },
          { id: 3, active: false, pinned: false, audible: true, url: "https://example.com/audible" },
          { id: 4, active: false, pinned: false, audible: false, url: "about:blank" },
          { active: false, pinned: false, audible: false, url: "https://example.com/no-id" },
          { id: 6, active: false, pinned: false, audible: false }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  await backgroundModule.__testing.runSuspendSweep(80);

  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("runSuspendSweep skips URLs above the restorable max length", { concurrency: false }, async () => {
  setNowMinute(81);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (Object.keys(queryInfo).length === 0) {
        return [
          {
            id: 71,
            windowId: 17,
            active: false,
            pinned: false,
            audible: false,
            url: TOO_LONG_URL,
            title: "Too Long"
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  events.tabsOnActivated.dispatch({ tabId: 71, windowId: 17 });

  setNowMinute(160);
  await backgroundModule.__testing.runSuspendSweep(160);

  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("action click suspends active tab immediately by bypassing active and timeout guards", { concurrency: false }, async () => {
  setNowMinute(120);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.actionOnClicked.dispatch({
    id: 99,
    windowId: 11,
    active: true,
    pinned: false,
    audible: false,
    url: "https://example.com/manual",
    title: "Manual Suspend"
  });

  await flushAsyncWork();

  assert.equal(calls.tabsUpdateCalls.length, 1);
  const payload = decodePayloadFromUpdateCall(calls.tabsUpdateCalls[0]);
  assert.equal(payload.u, "https://example.com/manual");
  assert.equal(payload.t, "Manual Suspend");
  assert.equal(payload.ts, "120");
});

test("action click still skips pinned, audible, and internal URLs", { concurrency: false }, async () => {
  setNowMinute(121);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.actionOnClicked.dispatch({
    id: 10,
    active: true,
    pinned: true,
    audible: false,
    url: "https://example.com/pinned"
  });
  events.actionOnClicked.dispatch({
    id: 11,
    active: true,
    pinned: false,
    audible: true,
    url: "https://example.com/audible"
  });
  events.actionOnClicked.dispatch({
    id: 12,
    active: true,
    pinned: false,
    audible: false,
    url: "about:blank"
  });

  await flushAsyncWork();

  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("action click skips exact excluded hosts", { concurrency: false }, async () => {
  setNowMinute(122);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 60,
          excludedHosts: ["example.com"],
          skipPinned: true,
          skipAudible: true
        }
      }
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.actionOnClicked.dispatch({
    id: 130,
    active: true,
    pinned: false,
    audible: false,
    url: "https://example.com/blocked"
  });

  await flushAsyncWork();

  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("action click applies wildcard exclusions to subdomains only", { concurrency: false }, async () => {
  setNowMinute(123);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 60,
          excludedHosts: ["*.example.com"],
          skipPinned: true,
          skipAudible: true
        }
      }
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.actionOnClicked.dispatch({
    id: 131,
    active: true,
    pinned: false,
    audible: false,
    url: "https://api.example.com/blocked"
  });
  events.actionOnClicked.dispatch({
    id: 132,
    active: true,
    pinned: false,
    audible: false,
    url: "https://example.com/allowed-apex"
  });

  await flushAsyncWork();

  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(calls.tabsUpdateCalls[0][0], 132);
});

test("action click skips URLs above the restorable max length", { concurrency: false }, async () => {
  setNowMinute(122);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.actionOnClicked.dispatch({
    id: 13,
    active: true,
    pinned: false,
    audible: false,
    url: TOO_LONG_URL
  });

  await flushAsyncWork();

  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("payload URL builder round-trips encoded fields", { concurrency: false }, async () => {
  setNowMinute(122);

  const { backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();

  const destination = backgroundModule.__testing.buildSuspendedUrl({
    u: "https://example.com/path?q=a b",
    t: " Trimmed Title ",
    ts: 333
  });

  const parsed = new URL(destination);
  assert.equal(parsed.pathname, "/suspended.html");
  assert.equal(parsed.searchParams.get("u"), "https://example.com/path?q=a b");
  assert.equal(parsed.searchParams.get("t"), " Trimmed Title ");
  assert.equal(parsed.searchParams.get("ts"), "333");
});

test("runSuspendSweep continues when one tab update fails", { concurrency: false }, async () => {
  setNowMinute(2);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (Object.keys(queryInfo).length === 0) {
        return [
          {
            id: 201,
            windowId: 8,
            active: false,
            pinned: false,
            audible: false,
            url: "https://example.com/fail",
            title: "Fail Me"
          },
          {
            id: 202,
            windowId: 8,
            active: false,
            pinned: false,
            audible: false,
            url: "https://example.com/pass",
            title: "Pass Me"
          }
        ];
      }

      return [];
    },
    updateResponder(tabId) {
      if (tabId === 201) {
        throw new Error("simulated tabs.update failure");
      }

      return {};
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  events.tabsOnActivated.dispatch({ tabId: 201, windowId: 8 });
  events.tabsOnActivated.dispatch({ tabId: 202, windowId: 8 });

  setNowMinute(100);
  await backgroundModule.__testing.runSuspendSweep(100);

  assert.equal(calls.tabsUpdateCalls.length, 2);
  const successPayload = decodePayloadFromUpdateCall(calls.tabsUpdateCalls[1]);
  assert.equal(successPayload.u, "https://example.com/pass");
  assert.equal(successPayload.ts, "100");
});

test("runSuspendSweep trims and caps title payload at 120 characters", { concurrency: false }, async () => {
  setNowMinute(3);

  const longTitle = `   ${"A".repeat(140)}   `;
  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (Object.keys(queryInfo).length === 0) {
        return [
          {
            id: 303,
            windowId: 4,
            active: false,
            pinned: false,
            audible: false,
            url: "https://example.com/long-title",
            title: longTitle
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  events.tabsOnActivated.dispatch({ tabId: 303, windowId: 4 });

  setNowMinute(90);
  await backgroundModule.__testing.runSuspendSweep(90);

  assert.equal(calls.tabsUpdateCalls.length, 1);
  const payload = decodePayloadFromUpdateCall(calls.tabsUpdateCalls[0]);
  assert.equal(payload.t.length, 120);
  assert.equal(payload.t, "A".repeat(120));
});

test("focus switch starts timeout from switch-away minute", { concurrency: false }, async () => {
  setNowMinute(1);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 2,
          excludedHosts: [],
          skipPinned: true,
          skipAudible: true
        }
      }
    },
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [{ id: 2, windowId: 1, active: true, url: "https://example.com/two" }];
      }

      if (Object.keys(queryInfo).length === 0) {
        return [
          { id: 1, windowId: 1, active: false, pinned: false, audible: false, url: "https://example.com/one" },
          { id: 2, windowId: 1, active: true, pinned: false, audible: false, url: "https://example.com/two" }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.tabsOnActivated.dispatch({ tabId: 1, windowId: 1 });
  setNowMinute(5);
  events.tabsOnActivated.dispatch({ tabId: 2, windowId: 1 });

  setNowMinute(6);
  await backgroundModule.__testing.runSuspendSweep(6);
  assert.equal(calls.tabsUpdateCalls.length, 0);

  setNowMinute(7);
  await backgroundModule.__testing.runSuspendSweep(7);
  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(calls.tabsUpdateCalls[0][0], 1);
});

test("missing activity baseline delays suspend until one full timeout interval", { concurrency: false }, async () => {
  setNowMinute(10);

  const { calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 2,
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

      if (Object.keys(queryInfo).length === 0) {
        return [{ id: 50, windowId: 5, active: false, pinned: false, audible: false, url: "https://example.com/baseline" }];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  await backgroundModule.__testing.runSuspendSweep(10);
  assert.equal(calls.tabsUpdateCalls.length, 0);

  await backgroundModule.__testing.runSuspendSweep(11);
  assert.equal(calls.tabsUpdateCalls.length, 0);

  await backgroundModule.__testing.runSuspendSweep(12);
  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(calls.tabsUpdateCalls[0][0], 50);
});

test("persisted activity survives worker restart and enables suspend without reactivation", { concurrency: false }, async () => {
  setNowMinute(1);

  const queryResponder = (queryInfo) => {
    if (queryInfo.active === true) {
      return [{ id: 2, windowId: 7, active: true, url: "https://example.com/two" }];
    }

    if (Object.keys(queryInfo).length === 0) {
      return [
        { id: 1, windowId: 7, active: false, pinned: false, audible: false, url: "https://example.com/one" },
        { id: 2, windowId: 7, active: true, pinned: false, audible: false, url: "https://example.com/two" }
      ];
    }

    return [];
  };

  const firstRun = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 2,
          excludedHosts: [],
          skipPinned: true,
          skipAudible: true
        }
      }
    },
    queryResponder
  });

  await firstRun.backgroundModule.__testing.waitForRuntimeReady();
  firstRun.backgroundModule.__testing.resetActivityState();

  firstRun.events.tabsOnActivated.dispatch({ tabId: 1, windowId: 7 });
  setNowMinute(2);
  firstRun.events.tabsOnActivated.dispatch({ tabId: 2, windowId: 7 });
  await firstRun.backgroundModule.__testing.flushPersistedActivityWrites();

  assert.equal(Array.isArray(firstRun.calls.storageData[ACTIVITY_STORAGE_KEY]?.activity), true);
  const restartedStorageSeed = { ...firstRun.calls.storageData };

  restoreBackgroundGlobals();

  setNowMinute(4);
  const secondRun = await importBackgroundWithMock({
    storageSeed: restartedStorageSeed,
    queryResponder
  });

  await secondRun.backgroundModule.__testing.waitForRuntimeReady();
  await secondRun.backgroundModule.__testing.runSuspendSweep(4);

  assert.equal(secondRun.calls.tabsUpdateCalls.length, 1);
  assert.equal(secondRun.calls.tabsUpdateCalls[0][0], 1);

  restoreBackgroundGlobals();
});

test.afterEach(() => {
  restoreBackgroundGlobals();
  delete globalThis.location;
  delete globalThis.document;
});
