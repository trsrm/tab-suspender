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
const RECOVERY_STORAGE_KEY = "recoveryState";

function decodePayloadFromUpdateCall(backgroundModule, updateCall) {
  const [, updateProperties] = updateCall;
  const destinationUrl = updateProperties.url;
  const decodedPayload = backgroundModule.__testing.decodeSuspendedUrl(destinationUrl);

  return {
    destinationUrl,
    format: decodedPayload?.format ?? null,
    u: decodedPayload?.u ?? null,
    t: decodedPayload?.t ?? null,
    ts: decodedPayload?.ts != null ? String(decodedPayload.ts) : null
  };
}

function isSweepCandidateQuery(queryInfo) {
  return queryInfo && queryInfo.active === false;
}

test("runSuspendSweep suspends eligible idle tab with encoded payload", { concurrency: false }, async () => {
  setNowMinute(1);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 60,
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

      if (isSweepCandidateQuery(queryInfo)) {
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

  const payload = decodePayloadFromUpdateCall(backgroundModule, calls.tabsUpdateCalls[0]);
  assert.equal(payload.destinationUrl.startsWith("data:text/html"), true);
  assert.equal(payload.format, "dataUrl");
  assert.equal(payload.u, "https://example.com/page?x=1");
  assert.equal(payload.t, "Example Tab");
  assert.equal(payload.ts, "70");
  await backgroundModule.__testing.flushPersistedRecoveryWrites();
  assert.deepEqual(calls.storageData[RECOVERY_STORAGE_KEY], {
    schemaVersion: 1,
    entries: [
      {
        url: "https://example.com/page?x=1",
        title: "Example Tab",
        suspendedAtMinute: 70
      }
    ]
  });
});

test("runSuspendSweep skips active, pinned, audible, internal, invalid-id, and missing-url tabs", { concurrency: false }, async () => {
  setNowMinute(80);

  const { calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (isSweepCandidateQuery(queryInfo)) {
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

      if (isSweepCandidateQuery(queryInfo)) {
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
  const payload = decodePayloadFromUpdateCall(backgroundModule, calls.tabsUpdateCalls[0]);
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

test("runSuspendSweep applies site profile override to allow pinned tab suspension", { concurrency: false }, async () => {
  setNowMinute(200);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 2,
        settings: {
          idleMinutes: 60,
          excludedHosts: [],
          skipPinned: true,
          skipAudible: true,
          siteProfiles: [
            {
              id: "allow-pinned",
              hostRule: "example.com",
              overrides: {
                skipPinned: false
              }
            }
          ]
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
            id: 410,
            windowId: 41,
            active: false,
            pinned: true,
            audible: false,
            url: "https://example.com/profile-pinned",
            title: "Profile Pinned"
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  events.tabsOnActivated.dispatch({ tabId: 410, windowId: 41 });

  setNowMinute(270);
  await backgroundModule.__testing.runSuspendSweep(270);

  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(calls.queryCalls.some((query) => query && query.active === false && query.pinned === false), false);
});

test("action click applies site profile excludeFromSuspend override", { concurrency: false }, async () => {
  setNowMinute(210);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 2,
        settings: {
          idleMinutes: 60,
          excludedHosts: [],
          skipPinned: false,
          skipAudible: false,
          siteProfiles: [
            {
              id: "exclude-1",
              hostRule: "example.com",
              overrides: {
                excludeFromSuspend: true
              }
            }
          ]
        }
      }
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.actionOnClicked.dispatch({
    id: 510,
    active: true,
    pinned: false,
    audible: false,
    url: "https://example.com/do-not-suspend"
  });

  await flushAsyncWork();

  assert.equal(calls.tabsUpdateCalls.length, 0);
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

test("recovery ledger dedupes URLs and caps at 100 entries", { concurrency: false }, async () => {
  setNowMinute(300);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  for (let i = 0; i < 105; i += 1) {
    events.actionOnClicked.dispatch({
      id: 10_000 + i,
      active: true,
      pinned: false,
      audible: false,
      url: `https://example.com/recovery-${i}`,
      title: `Recovery ${i}`
    });
  }

  events.actionOnClicked.dispatch({
    id: 20_000,
    active: true,
    pinned: false,
    audible: false,
    url: "https://example.com/recovery-104",
    title: "Recovery 104 latest"
  });

  await flushAsyncWork();
  await backgroundModule.__testing.flushPersistedRecoveryWrites();

  const entries = calls.storageData[RECOVERY_STORAGE_KEY]?.entries ?? [];
  assert.equal(entries.length, 100);
  assert.equal(entries[0].url, "https://example.com/recovery-104");
  assert.equal(entries[0].title, "Recovery 104 latest");
  assert.equal(entries.some((entry) => entry.url === "https://example.com/recovery-0"), false);
});

test("recovery persistence failure does not block suspend success", { concurrency: false }, async () => {
  setNowMinute(301);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSetResponder(items) {
      if (items[RECOVERY_STORAGE_KEY]) {
        throw new Error("simulated recovery write failure");
      }
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  events.actionOnClicked.dispatch({
    id: 3030,
    active: true,
    pinned: false,
    audible: false,
    url: "https://example.com/recovery-failure",
    title: "Recovery failure path"
  });

  await flushAsyncWork();
  await backgroundModule.__testing.flushPersistedRecoveryWrites();

  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(calls.tabsUpdateCalls[0][0], 3030);
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

  const decoded = backgroundModule.__testing.decodeSuspendedUrl(destination);
  assert.equal(backgroundModule.__testing.isSuspendedDataUrl(destination), true);
  assert.equal(destination.length < 2600, true);
  assert.equal(decoded?.format, "dataUrl");
  assert.equal(decoded?.u, "https://example.com/path?q=a b");
  assert.equal(decoded?.t, "Trimmed Title");
  assert.equal(decoded?.ts, 333);

  const decodedHtml = decodeURIComponent(destination.split(",").slice(1).join(","));
  assert.equal(decodedHtml.includes("TS_DATA_SUSPENDED_PAGE_V1"), true);
  assert.equal(decodedHtml.includes('id="restoreControl"'), true);
  assert.equal(decodedHtml.includes('href="https://example.com/path?q=a b"'), true);
  assert.equal(decodedHtml.includes("Ready to restore this tab."), false);
  assert.equal(decodedHtml.includes("<strong>Original URL</strong>"), false);
});

test("runSuspendSweep continues when one tab update fails", { concurrency: false }, async () => {
  setNowMinute(2);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 60,
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

      if (isSweepCandidateQuery(queryInfo)) {
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
  const successPayload = decodePayloadFromUpdateCall(backgroundModule, calls.tabsUpdateCalls[1]);
  assert.equal(successPayload.u, "https://example.com/pass");
  assert.equal(successPayload.ts, "100");
});

test("runSuspendSweep trims and caps title payload at 120 characters", { concurrency: false }, async () => {
  setNowMinute(3);

  const longTitle = `   ${"A".repeat(140)}   `;
  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 60,
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

      if (isSweepCandidateQuery(queryInfo)) {
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
  const payload = decodePayloadFromUpdateCall(backgroundModule, calls.tabsUpdateCalls[0]);
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
          idleMinutes: 60,
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

      if (isSweepCandidateQuery(queryInfo)) {
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

  setNowMinute(64);
  await backgroundModule.__testing.runSuspendSweep(64);
  assert.equal(calls.tabsUpdateCalls.length, 0);

  setNowMinute(65);
  await backgroundModule.__testing.runSuspendSweep(65);
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
          idleMinutes: 60,
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

      if (isSweepCandidateQuery(queryInfo)) {
        return [{ id: 50, windowId: 5, active: false, pinned: false, audible: false, url: "https://example.com/baseline" }];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();

  await backgroundModule.__testing.runSuspendSweep(10);
  assert.equal(calls.tabsUpdateCalls.length, 0);

  await backgroundModule.__testing.runSuspendSweep(69);
  assert.equal(calls.tabsUpdateCalls.length, 0);

  await backgroundModule.__testing.runSuspendSweep(70);
  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(calls.tabsUpdateCalls[0][0], 50);
});

test("persisted activity survives worker restart and enables suspend without reactivation", { concurrency: false }, async () => {
  setNowMinute(1);

  const queryResponder = (queryInfo) => {
    if (queryInfo.active === true) {
      return [{ id: 2, windowId: 7, active: true, url: "https://example.com/two" }];
    }

    if (isSweepCandidateQuery(queryInfo) || Object.keys(queryInfo).length === 0) {
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
          idleMinutes: 60,
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

  setNowMinute(62);
  const secondRun = await importBackgroundWithMock({
    storageSeed: restartedStorageSeed,
    queryResponder
  });

  await secondRun.backgroundModule.__testing.waitForRuntimeReady();
  await secondRun.backgroundModule.__testing.runSuspendSweep(62);

  assert.equal(secondRun.calls.tabsUpdateCalls.length, 1);
  assert.equal(secondRun.calls.tabsUpdateCalls[0][0], 1);

  restoreBackgroundGlobals();
});

test("runSuspendSweep applies filtered query candidates from current settings", { concurrency: false }, async () => {
  setNowMinute(210);

  const { calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 60,
          excludedHosts: [],
          skipPinned: true,
          skipAudible: true
        }
      }
    },
    queryResponder(queryInfo) {
      if (isSweepCandidateQuery(queryInfo)) {
        return [];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  await backgroundModule.__testing.runSuspendSweep(210);

  assert.deepEqual(calls.queryCalls.at(-1), {
    active: false,
    pinned: false,
    audible: false
  });
});

test("runSuspendSweep falls back to unfiltered query when filtered query fails", { concurrency: false }, async () => {
  setNowMinute(211);

  const { calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (isSweepCandidateQuery(queryInfo)) {
        throw new Error("simulated filtered query failure");
      }

      if (Object.keys(queryInfo).length === 0) {
        return [
          {
            id: 900,
            windowId: 9,
            active: false,
            pinned: false,
            audible: false,
            url: "https://example.com/fallback",
            title: "Fallback tab"
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  await backgroundModule.__testing.runSuspendSweep(211);

  assert.deepEqual(calls.queryCalls.slice(-2), [
    { active: false, pinned: false, audible: false },
    {}
  ]);
  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("runSuspendSweep skips already suspended extension and data pages", { concurrency: false }, async () => {
  setNowMinute(212);

  const suspendedDataUrl = "data:text/html;charset=utf-8,%3Cmeta%20name%3D%22tab-suspender-signature%22%20content%3D%22TS_DATA_SUSPENDED_PAGE_V1%22%3E%3Cscript%20id%3D%22tab-suspender-payload%22%20type%3D%22application%2Fjson%22%3E%7B%22u%22%3A%22https%3A%2F%2Fexample.com%22%2C%22t%22%3A%22Saved%22%2C%22ts%22%3A10%7D%3C%2Fscript%3E";
  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (!isSweepCandidateQuery(queryInfo)) {
        return [];
      }

      return [
        {
          id: 950,
          windowId: 95,
          active: false,
          pinned: false,
          audible: false,
          url: "safari-extension://test-extension/suspended.html?u=https%3A%2F%2Fexample.com",
          title: "Suspended tab"
        },
        {
          id: 951,
          windowId: 95,
          active: false,
          pinned: false,
          audible: false,
          url: suspendedDataUrl,
          title: "Suspended tab data"
        }
      ];
    }
  });

  await backgroundModule.__testing.waitForRuntimeReady();
  backgroundModule.__testing.resetActivityState();
  events.tabsOnActivated.dispatch({ tabId: 950, windowId: 95 });
  await backgroundModule.__testing.runSuspendSweep(212);

  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test.afterEach(() => {
  restoreBackgroundGlobals();
  delete globalThis.location;
  delete globalThis.document;
});
