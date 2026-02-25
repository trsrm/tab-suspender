import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OPTIONS_MODULE_PATH = path.resolve("build/extension/options.js");
const SETTINGS_STORAGE_KEY = "settings";
const REAL_DOCUMENT = globalThis.document;

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

function createEventTarget(base = {}) {
  const listeners = new Map();

  return {
    ...base,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, payload = {}) {
      const listener = listeners.get(type);

      if (typeof listener === "function") {
        listener(payload);
      }
    }
  };
}

function createInput({ value = "", checked = false } = {}) {
  return createEventTarget({
    value,
    checked,
    disabled: false,
    attributes: {},
    setAttribute(name, attributeValue) {
      this.attributes[name] = String(attributeValue);
    }
  });
}

function createForm() {
  const form = createEventTarget({});

  return {
    ...form,
    submit() {
      form.dispatch("submit", {
        preventDefault() {}
      });
    }
  };
}

function createElement({ textContent = "", hidden = false } = {}) {
  return createEventTarget({
    textContent,
    hidden,
    disabled: false
  });
}

function createDom() {
  const elements = {
    settingsForm: createForm(),
    idleMinutes: createInput(),
    idleMinutesError: createElement({ hidden: true }),
    skipPinned: createInput({ checked: false }),
    skipAudible: createInput({ checked: false }),
    excludedHosts: createInput(),
    saveButton: createElement(),
    status: createElement({ textContent: "Loading settings..." })
  };

  return {
    elements,
    document: {
      getElementById(id) {
        return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
      }
    }
  };
}

function createChromeStorageMock(storageSeed = {}) {
  const storageData = { ...storageSeed };
  const storageGetCalls = [];
  const storageSetCalls = [];

  const chromeMock = {
    runtime: {
      lastError: undefined
    },
    storage: {
      onChanged: createEvent(),
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
    storageData,
    storageGetCalls,
    storageSetCalls
  };
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function importOptionsWithMocks(storageSeed = {}) {
  const { elements, document } = createDom();
  const storageMock = createChromeStorageMock(storageSeed);

  globalThis.document = document;
  globalThis.chrome = storageMock.chromeMock;

  const moduleUrl = `${pathToFileURL(OPTIONS_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  await import(moduleUrl);
  await flushAsyncWork();
  await flushAsyncWork();

  return { elements, ...storageMock };
}

test("options page loads defaults when storage is empty", { concurrency: false }, async () => {
  const { elements, storageGetCalls } = await importOptionsWithMocks();

  assert.equal(storageGetCalls.length, 1);
  assert.equal(storageGetCalls[0], SETTINGS_STORAGE_KEY);
  assert.equal(elements.idleMinutes.value, "60");
  assert.equal(elements.skipPinned.checked, true);
  assert.equal(elements.skipAudible.checked, true);
  assert.equal(elements.excludedHosts.value, "");
  assert.equal(elements.status.textContent, "Settings loaded.");
});

test("options page loads persisted settings values", { concurrency: false }, async () => {
  const { elements } = await importOptionsWithMocks({
    [SETTINGS_STORAGE_KEY]: {
      schemaVersion: 1,
      settings: {
        idleMinutes: 90,
        excludedHosts: ["example.com", "*.news.example.org"],
        skipPinned: false,
        skipAudible: true
      }
    }
  });

  assert.equal(elements.idleMinutes.value, "90");
  assert.equal(elements.skipPinned.checked, false);
  assert.equal(elements.skipAudible.checked, true);
  assert.equal(elements.excludedHosts.value, "example.com\n*.news.example.org");
  assert.equal(elements.status.textContent, "Settings loaded.");
});

test("save writes versioned sanitized settings payload", { concurrency: false }, async () => {
  const { elements, storageData, storageSetCalls } = await importOptionsWithMocks();

  elements.idleMinutes.value = "30";
  elements.skipPinned.checked = false;
  elements.skipAudible.checked = false;
  elements.excludedHosts.value = "  Example.COM\nfoo.com,FOO.com\nbar.com\n";

  elements.settingsForm.submit();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(storageSetCalls.length, 1);
  assert.deepEqual(storageData[SETTINGS_STORAGE_KEY], {
    schemaVersion: 1,
    settings: {
      idleMinutes: 30,
      excludedHosts: ["example.com", "foo.com", "bar.com"],
      skipPinned: false,
      skipAudible: false
    }
  });
  assert.equal(elements.status.textContent, "Settings saved.");
  assert.equal(elements.idleMinutesError.hidden, true);
});

test("save ignores invalid excluded host entries with non-blocking status", { concurrency: false }, async () => {
  const { elements, storageData } = await importOptionsWithMocks();

  elements.idleMinutes.value = "45";
  elements.excludedHosts.value = "example.com\n*.news.example.com\nhttps://bad.com\nbad host\n*bad.com";

  elements.settingsForm.submit();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.deepEqual(storageData[SETTINGS_STORAGE_KEY], {
    schemaVersion: 1,
    settings: {
      idleMinutes: 45,
      excludedHosts: ["example.com", "*.news.example.com"],
      skipPinned: true,
      skipAudible: true
    }
  });
  assert.equal(elements.status.textContent, "Settings saved. Ignored 3 invalid excluded host entries.");
});

test("invalid idle minutes blocks save and shows field error", { concurrency: false }, async () => {
  const { elements, storageSetCalls } = await importOptionsWithMocks();

  elements.idleMinutes.value = "0";
  elements.settingsForm.submit();
  await flushAsyncWork();

  assert.equal(storageSetCalls.length, 0);
  assert.equal(elements.idleMinutesError.hidden, false);
  assert.equal(elements.idleMinutesError.textContent, "Enter a whole number from 1 to 1440.");
  assert.equal(elements.status.textContent, "Settings were not saved.");
});

test.afterEach(() => {
  if (REAL_DOCUMENT === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = REAL_DOCUMENT;
  }

  delete globalThis.chrome;
});
