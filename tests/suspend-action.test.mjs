import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REAL_DATE_NOW = Date.now;
const BACKGROUND_MODULE_PATH = path.resolve("build/extension/background.js");
const SUSPENDED_MODULE_PATH = path.resolve("build/extension/suspended.js");

function createEvent() {
  const listeners = [];

  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
    dispatch(...args) {
      for (const listener of listeners) {
        listener(...args);
      }
    }
  };
}

function createChromeMock({ queryResponder = () => [], updateResponder = () => ({}) } = {}) {
  const runtimeOnInstalled = createEvent();
  const runtimeOnStartup = createEvent();
  const runtimeOnMessage = createEvent();

  const tabsOnActivated = createEvent();
  const tabsOnUpdated = createEvent();
  const tabsOnRemoved = createEvent();
  const tabsOnReplaced = createEvent();

  const windowsOnFocusChanged = createEvent();
  const alarmsOnAlarm = createEvent();
  const actionOnClicked = createEvent();

  const queryCalls = [];
  const tabsUpdateCalls = [];
  const alarmCreateCalls = [];

  const chromeMock = {
    runtime: {
      onInstalled: runtimeOnInstalled,
      onStartup: runtimeOnStartup,
      onMessage: runtimeOnMessage,
      lastError: undefined,
      getURL(relativePath) {
        return `safari-extension://test-extension/${relativePath}`;
      }
    },
    tabs: {
      onActivated: tabsOnActivated,
      onUpdated: tabsOnUpdated,
      onRemoved: tabsOnRemoved,
      onReplaced: tabsOnReplaced,
      query(queryInfo, callback) {
        queryCalls.push(queryInfo);

        return Promise.resolve()
          .then(() => queryResponder(queryInfo))
          .then((tabs) => {
            if (callback) {
              callback(tabs);
            }

            return tabs;
          });
      },
      update(tabId, updateProperties, callback) {
        tabsUpdateCalls.push([tabId, updateProperties]);

        return Promise.resolve()
          .then(() => updateResponder(tabId, updateProperties))
          .then((result) => {
            if (callback) {
              callback(result);
            }

            return result;
          })
          .catch((error) => {
            if (callback) {
              chromeMock.runtime.lastError = {
                message: error instanceof Error ? error.message : String(error)
              };
              callback(undefined);
              chromeMock.runtime.lastError = undefined;
              return undefined;
            }

            throw error;
          });
      }
    },
    windows: {
      onFocusChanged: windowsOnFocusChanged,
      WINDOW_ID_NONE: -1
    },
    alarms: {
      onAlarm: alarmsOnAlarm,
      create(name, alarmInfo) {
        alarmCreateCalls.push({ name, alarmInfo });
      }
    },
    action: {
      onClicked: actionOnClicked
    }
  };

  return {
    chromeMock,
    events: {
      tabsOnActivated,
      actionOnClicked
    },
    calls: {
      queryCalls,
      tabsUpdateCalls,
      alarmCreateCalls
    }
  };
}

function setNowMinute(minute) {
  Date.now = () => minute * 60_000 + 999;
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function importBackgroundWithMock(options = {}) {
  const mock = createChromeMock(options);
  globalThis.chrome = mock.chromeMock;

  const moduleUrl = `${pathToFileURL(BACKGROUND_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  const backgroundModule = await import(moduleUrl);
  await flushAsyncWork();

  return { ...mock, backgroundModule };
}

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

function createElement() {
  return {
    textContent: "",
    disabled: false
  };
}

async function importSuspendedWithSearch(search) {
  const elements = {
    title: createElement(),
    summary: createElement(),
    capturedAt: createElement(),
    status: createElement(),
    restoreButton: createElement()
  };

  globalThis.location = { search };
  globalThis.document = {
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };

  const moduleUrl = `${pathToFileURL(SUSPENDED_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  await import(moduleUrl);

  return elements;
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

  backgroundModule.__testing.resetActivityState();
  await backgroundModule.__testing.runSuspendSweep(80);

  assert.equal(calls.tabsUpdateCalls.length, 0);
});

test("action click suspends active tab immediately by bypassing active and timeout guards", { concurrency: false }, async () => {
  setNowMinute(120);

  const { events, calls, backgroundModule } = await importBackgroundWithMock();
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

test("payload URL builder round-trips encoded fields", { concurrency: false }, async () => {
  setNowMinute(122);

  const { backgroundModule } = await importBackgroundWithMock();

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

  backgroundModule.__testing.resetActivityState();
  events.tabsOnActivated.dispatch({ tabId: 303, windowId: 4 });

  setNowMinute(90);
  await backgroundModule.__testing.runSuspendSweep(90);

  assert.equal(calls.tabsUpdateCalls.length, 1);
  const payload = decodePayloadFromUpdateCall(calls.tabsUpdateCalls[0]);
  assert.equal(payload.t.length, 120);
  assert.equal(payload.t, "A".repeat(120));
});

test("suspended page decodes query payload and renders lightweight status text", { concurrency: false }, async () => {
  const params = new URLSearchParams({
    u: "https://example.com/path?q=1",
    t: "   Saved Title   ",
    ts: "700"
  });

  const elements = await importSuspendedWithSearch(`?${params.toString()}`);

  assert.equal(elements.title.textContent, "Saved Title");
  assert.equal(elements.summary.textContent, "Original tab: example.com");
  assert.equal(elements.capturedAt.textContent, "Captured at 1970-01-01 11:40 UTC.");
  assert.equal(elements.status.textContent, "Restore is disabled in Plan 4 and will be implemented in Plan 5.");
  assert.equal(elements.restoreButton.disabled, true);
});

test.afterEach(() => {
  Date.now = REAL_DATE_NOW;
  delete globalThis.chrome;
  delete globalThis.location;
  delete globalThis.document;
});
