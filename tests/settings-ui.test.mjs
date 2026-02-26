import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OPTIONS_MODULE_PATH = path.resolve("build/extension/options.js");
const SETTINGS_STORAGE_KEY = "settings";
const RECOVERY_STORAGE_KEY = "recoveryState";
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

  const target = {
    ...base,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, payload = {}) {
      const listener = listeners.get(type);

      if (typeof listener === "function") {
        listener(payload);
      }
    },
    click() {
      this.dispatch("click", {
        preventDefault() {}
      });
    }
  };

  return target;
}

function createNode(tagName, base = {}) {
  const node = createEventTarget({
    tagName: tagName.toUpperCase(),
    children: [],
    textContent: "",
    hidden: false,
    disabled: false,
    title: "",
    className: "",
    value: "",
    checked: false,
    attributes: {},
    type: "",
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nextChildren) {
      this.children = [...nextChildren];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    ...base
  });

  return node;
}

function createInput({ value = "", checked = false } = {}) {
  return createNode("input", {
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
  const form = createNode("form", {});

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
  return createNode("p", {
    textContent,
    hidden,
    disabled: false
  });
}

function createDom() {
  const elements = {
    settingsForm: createForm(),
    idleHours: createInput(),
    idleHoursError: createElement({ hidden: true }),
    skipPinned: createInput({ checked: false }),
    skipAudible: createInput({ checked: false }),
    excludedHosts: createInput(),
    saveButton: createElement(),
    status: createElement({ textContent: "Loading settings..." }),
    recoveryEmpty: createElement({ textContent: "Loading recently suspended tabs..." }),
    recoveryList: createNode("ul")
  };

  return {
    elements,
    document: {
      getElementById(id) {
        return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
      },
      createElement(tagName) {
        return createNode(tagName);
      }
    }
  };
}

function createChromeStorageMock({ storageSeed = {}, tabsCreateResponder = () => ({ id: 1 }) } = {}) {
  const storageData = { ...storageSeed };
  const storageGetCalls = [];
  const storageSetCalls = [];
  const tabsCreateCalls = [];

  const chromeMock = {
    runtime: {
      lastError: undefined
    },
    tabs: {
      create(createProperties, callback) {
        tabsCreateCalls.push(createProperties);

        return Promise.resolve()
          .then(() => tabsCreateResponder(createProperties))
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
    storageSetCalls,
    tabsCreateCalls
  };
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function importOptionsWithMocks({ storageSeed = {}, tabsCreateResponder } = {}) {
  const { elements, document } = createDom();
  const storageMock = createChromeStorageMock({ storageSeed, tabsCreateResponder });

  globalThis.document = document;
  globalThis.chrome = storageMock.chromeMock;

  const moduleUrl = `${pathToFileURL(OPTIONS_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  const optionsModule = await import(moduleUrl);
  await flushAsyncWork();
  await flushAsyncWork();

  return { elements, optionsModule, ...storageMock };
}

test("options page loads defaults when storage is empty", { concurrency: false }, async () => {
  const { elements, storageGetCalls } = await importOptionsWithMocks();

  assert.equal(storageGetCalls.length, 2);
  assert.equal(storageGetCalls[0], SETTINGS_STORAGE_KEY);
  assert.equal(storageGetCalls[1], RECOVERY_STORAGE_KEY);
  assert.equal(elements.idleHours.value, "24");
  assert.equal(elements.skipPinned.checked, true);
  assert.equal(elements.skipAudible.checked, true);
  assert.equal(elements.excludedHosts.value, "");
  assert.equal(elements.status.textContent, "Settings loaded.");
});

test("options page loads persisted settings values", { concurrency: false }, async () => {
  const { elements } = await importOptionsWithMocks({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          idleMinutes: 4320,
          excludedHosts: ["example.com", "*.news.example.org"],
          skipPinned: false,
          skipAudible: true
        }
      }
    }
  });

  assert.equal(elements.idleHours.value, "72");
  assert.equal(elements.skipPinned.checked, false);
  assert.equal(elements.skipAudible.checked, true);
  assert.equal(elements.excludedHosts.value, "example.com\n*.news.example.org");
  assert.equal(elements.status.textContent, "Settings loaded.");
});

test("save writes versioned sanitized settings payload", { concurrency: false }, async () => {
  const { elements, storageData, storageSetCalls } = await importOptionsWithMocks();

  elements.idleHours.value = "30";
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
      idleMinutes: 1800,
      excludedHosts: ["example.com", "foo.com", "bar.com"],
      skipPinned: false,
      skipAudible: false
    }
  });
  assert.equal(elements.status.textContent, "Settings saved.");
  assert.equal(elements.idleHoursError.hidden, true);
});

test("save ignores invalid excluded host entries with non-blocking status", { concurrency: false }, async () => {
  const { elements, storageData } = await importOptionsWithMocks();

  elements.idleHours.value = "45";
  elements.excludedHosts.value = "example.com\n*.news.example.com\nhttps://bad.com\nbad host\n*bad.com";

  elements.settingsForm.submit();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.deepEqual(storageData[SETTINGS_STORAGE_KEY], {
    schemaVersion: 1,
    settings: {
      idleMinutes: 2700,
      excludedHosts: ["example.com", "*.news.example.com"],
      skipPinned: true,
      skipAudible: true
    }
  });
  assert.equal(elements.status.textContent, "Settings saved. Ignored 3 invalid excluded host entries.");
});

test("invalid idle hours blocks save and shows field error", { concurrency: false }, async () => {
  const { elements, storageSetCalls } = await importOptionsWithMocks();

  elements.idleHours.value = "0";
  elements.settingsForm.submit();
  await flushAsyncWork();

  assert.equal(storageSetCalls.length, 0);
  assert.equal(elements.idleHoursError.hidden, false);
  assert.equal(elements.idleHoursError.textContent, "Enter a whole number from 1 to 720.");
  assert.equal(elements.status.textContent, "Settings were not saved.");
});

test("options page renders recently suspended list and reopens valid entries", { concurrency: false }, async () => {
  const { elements, tabsCreateCalls } = await importOptionsWithMocks({
    storageSeed: {
      [RECOVERY_STORAGE_KEY]: {
        schemaVersion: 1,
        entries: [
          {
            url: "https://example.com/a",
            title: "A",
            suspendedAtMinute: 100
          },
          {
            url: "https://example.com/b",
            title: "",
            suspendedAtMinute: 90
          }
        ]
      }
    }
  });

  assert.equal(elements.recoveryList.children.length, 2);
  assert.equal(elements.recoveryEmpty.hidden, true);

  const firstRow = elements.recoveryList.children[0];
  const reopenButton = firstRow.children[1];
  reopenButton.click();
  await flushAsyncWork();

  assert.equal(tabsCreateCalls.length, 1);
  assert.deepEqual(tabsCreateCalls[0], { url: "https://example.com/a" });
  assert.equal(elements.status.textContent, "Reopened suspended tab in a new tab.");
});

test("options page disables reopen for invalid recovery URLs", { concurrency: false }, async () => {
  const { elements, tabsCreateCalls } = await importOptionsWithMocks({
    storageSeed: {
      [RECOVERY_STORAGE_KEY]: {
        schemaVersion: 1,
        entries: [
          {
            url: "chrome://settings",
            title: "Not restorable",
            suspendedAtMinute: 120
          }
        ]
      }
    }
  });

  assert.equal(elements.recoveryList.children.length, 0);
  assert.equal(elements.recoveryEmpty.hidden, false);
  assert.equal(elements.recoveryEmpty.textContent, "No recently suspended tabs yet.");
  assert.equal(tabsCreateCalls.length, 0);
});

test("recovery list reuses unchanged row nodes across rerenders", { concurrency: false }, async () => {
  const { elements, optionsModule } = await importOptionsWithMocks({
    storageSeed: {
      [RECOVERY_STORAGE_KEY]: {
        schemaVersion: 1,
        entries: [
          {
            url: "https://example.com/a",
            title: "A",
            suspendedAtMinute: 100
          },
          {
            url: "https://example.com/b",
            title: "B",
            suspendedAtMinute: 99
          }
        ]
      }
    }
  });

  const firstRow = elements.recoveryList.children[0];
  const secondRow = elements.recoveryList.children[1];

  optionsModule.__testing.renderRecoveryList(elements, [
    {
      url: "https://example.com/a",
      title: "A",
      suspendedAtMinute: 100
    },
    {
      url: "https://example.com/b",
      title: "B",
      suspendedAtMinute: 99
    }
  ]);

  assert.equal(elements.recoveryList.children[0], firstRow);
  assert.equal(elements.recoveryList.children[1], secondRow);
});

test("recovery list only replaces changed rows across rerenders", { concurrency: false }, async () => {
  const { elements, optionsModule } = await importOptionsWithMocks({
    storageSeed: {
      [RECOVERY_STORAGE_KEY]: {
        schemaVersion: 1,
        entries: [
          {
            url: "https://example.com/a",
            title: "A",
            suspendedAtMinute: 100
          },
          {
            url: "https://example.com/b",
            title: "B",
            suspendedAtMinute: 99
          }
        ]
      }
    }
  });

  const originalFirstRow = elements.recoveryList.children[0];
  const originalSecondRow = elements.recoveryList.children[1];

  optionsModule.__testing.renderRecoveryList(elements, [
    {
      url: "https://example.com/a",
      title: "A",
      suspendedAtMinute: 100
    },
    {
      url: "https://example.com/b",
      title: "Updated",
      suspendedAtMinute: 99
    }
  ]);

  assert.equal(elements.recoveryList.children[0], originalFirstRow);
  assert.notEqual(elements.recoveryList.children[1], originalSecondRow);
});

test.afterEach(() => {
  if (REAL_DOCUMENT === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = REAL_DOCUMENT;
  }

  delete globalThis.chrome;
});
