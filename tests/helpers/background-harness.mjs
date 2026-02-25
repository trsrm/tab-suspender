import path from "node:path";
import { pathToFileURL } from "node:url";

const REAL_DATE_NOW = Date.now;
const BACKGROUND_MODULE_PATH = path.resolve("build/extension/background.js");

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

export function createChromeMock({ queryResponder = () => [], updateResponder = () => ({}), storageSeed = {} } = {}) {
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
  const storageGetCalls = [];
  const storageSetCalls = [];
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
    },
    storage: {
      onChanged: storageOnChanged,
      local: {
        get(key, callback) {
          storageGetCalls.push(key);
          const result = typeof key === "string" ? { [key]: storageData[key] } : {};

          return Promise.resolve().then(() => {
            if (callback) {
              callback(result);
            }

            return result;
          });
        },
        set(items, callback) {
          storageSetCalls.push(items);
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
      runtimeOnInstalled,
      runtimeOnStartup,
      runtimeOnMessage,
      tabsOnActivated,
      tabsOnUpdated,
      tabsOnRemoved,
      tabsOnReplaced,
      windowsOnFocusChanged,
      alarmsOnAlarm,
      actionOnClicked,
      storageOnChanged
    },
    calls: {
      queryCalls,
      tabsUpdateCalls,
      alarmCreateCalls,
      storageGetCalls,
      storageSetCalls,
      storageData
    }
  };
}

export function setNowMinute(minute, millisecondOffset = 0) {
  Date.now = () => minute * 60_000 + millisecondOffset;
}

export async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

export async function importBackgroundWithMock(options = {}) {
  const mock = createChromeMock(options);
  globalThis.chrome = mock.chromeMock;

  const moduleUrl = `${pathToFileURL(BACKGROUND_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  const backgroundModule = await import(moduleUrl);
  await flushAsyncWork();

  return { ...mock, backgroundModule };
}

export function restoreBackgroundGlobals() {
  Date.now = REAL_DATE_NOW;
  delete globalThis.chrome;
}
