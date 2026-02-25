import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REAL_DATE_NOW = Date.now;
const BACKGROUND_MODULE_PATH = path.resolve("build/extension/background.js");
const SETTINGS_STORAGE_KEY = "settings";

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

function createChromeMock({ queryResponder = () => [], updateResponder = () => ({}), storageSeed = {} } = {}) {
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
  const storageOnChanged = createEvent();

  const queryCalls = [];
  const tabsUpdateCalls = [];
  const alarmCreateCalls = [];
  const storageData = { ...storageSeed };

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
    },
    storage: {
      onChanged: storageOnChanged,
      local: {
        get(key, callback) {
          const result = typeof key === "string" ? { [key]: storageData[key] } : {};

          return Promise.resolve().then(() => {
            if (callback) {
              callback(result);
            }

            return result;
          });
        },
        set(items, callback) {
          Object.assign(storageData, items);

          return Promise.resolve().then(() => {
            if (callback) {
              callback();
            }
          });
        }
      }
    }
  };

  return {
    chromeMock,
    events: {
      tabsOnActivated,
      storageOnChanged
    },
    calls: {
      queryCalls,
      tabsUpdateCalls,
      alarmCreateCalls,
      storageData
    }
  };
}

function setNowMinute(minute) {
  Date.now = () => minute * 60_000 + 321;
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

test("background uses persisted settings for sweep decisions", { concurrency: false }, async () => {
  setNowMinute(1);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 5,
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

      if (Object.keys(queryInfo).length === 0) {
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

  await backgroundModule.__testing.waitForSettingsHydration();
  backgroundModule.__testing.resetActivityState();

  setNowMinute(1);
  events.tabsOnActivated.dispatch({ tabId: 91, windowId: 8 });

  setNowMinute(7);
  await backgroundModule.__testing.runSuspendSweep(7);

  assert.equal(calls.tabsUpdateCalls.length, 1);
  assert.equal(backgroundModule.__testing.getCurrentSettings().idleMinutes, 5);
  assert.equal(backgroundModule.__testing.getCurrentSettings().skipPinned, false);
});

test("storage.onChanged updates runtime settings without restart", { concurrency: false }, async () => {
  setNowMinute(2);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    queryResponder(queryInfo) {
      if (queryInfo.active === true) {
        return [];
      }

      if (Object.keys(queryInfo).length === 0) {
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

  await backgroundModule.__testing.waitForSettingsHydration();
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

  await backgroundModule.__testing.waitForSettingsHydration();

  assert.deepEqual(backgroundModule.__testing.getCurrentSettings(), {
    idleMinutes: 60,
    excludedHosts: [],
    skipPinned: true,
    skipAudible: true
  });
});

test("persisted excluded hosts do not alter policy decisions in Plan 6", { concurrency: false }, async () => {
  setNowMinute(4);

  const { events, calls, backgroundModule } = await importBackgroundWithMock({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 5,
          excludedHosts: ["example.com"],
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
        return [
          {
            id: 93,
            windowId: 10,
            active: false,
            pinned: false,
            audible: false,
            url: "https://example.com/allowed-for-now"
          }
        ];
      }

      return [];
    }
  });

  await backgroundModule.__testing.waitForSettingsHydration();
  backgroundModule.__testing.resetActivityState();

  events.tabsOnActivated.dispatch({ tabId: 93, windowId: 10 });

  setNowMinute(10);
  await backgroundModule.__testing.runSuspendSweep(10);

  assert.equal(calls.tabsUpdateCalls.length, 1);
});

test.afterEach(() => {
  Date.now = REAL_DATE_NOW;
  delete globalThis.chrome;
});
