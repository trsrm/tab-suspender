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
    href: "",
    download: "",
    files: null,
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
  const createdAnchors = [];
  const elements = {
    settingsForm: createForm(),
    idleHours: createInput(),
    idleHoursError: createElement({ hidden: true }),
    skipPinned: createInput({ checked: false }),
    skipAudible: createInput({ checked: false }),
    excludedHosts: createInput(),
    siteProfiles: createNode("ul"),
    addSiteProfileButton: createNode("button"),
    saveButton: createNode("button"),
    status: createElement({ textContent: "Loading settings..." }),
    importExportStatus: createElement({ textContent: "" }),
    importPreview: createNode("div", { hidden: true }),
    importPreviewSummary: createElement({ textContent: "" }),
    importPreviewWarnings: createElement({ textContent: "" }),
    exportConfigButton: createNode("button"),
    importConfigButton: createNode("button"),
    importConfigFile: createInput(),
    applyImportButton: createNode("button", { disabled: true }),
    cancelImportButton: createNode("button", { disabled: true }),
    recoveryEmpty: createElement({ textContent: "Loading recently suspended tabs..." }),
    recoveryStatus: createElement({ textContent: "" }),
    recoveryList: createNode("ul"),
    diagnosticsStatus: createElement({ textContent: "" }),
    diagnosticsSummary: createElement({ textContent: "" }),
    diagnosticsList: createNode("ul"),
    refreshDiagnosticsButton: createNode("button")
  };

  return {
    elements,
    createdAnchors,
    document: {
      getElementById(id) {
        return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
      },
      createElement(tagName) {
        const node = createNode(tagName);
        if (String(tagName).toLowerCase() === "a") {
          createdAnchors.push(node);
        }
        return node;
      }
    }
  };
}

function createChromeStorageMock({
  storageSeed = {},
  tabsCreateResponder = () => ({ id: 1 }),
  sendMessageResponder = () => ({ ok: false, message: "No diagnostics response." })
} = {}) {
  const storageData = { ...storageSeed };
  const storageGetCalls = [];
  const storageSetCalls = [];
  const tabsCreateCalls = [];

  const chromeMock = {
    runtime: {
      lastError: undefined,
      sendMessage(message, callback) {
        return Promise.resolve()
          .then(() => sendMessageResponder(message))
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

async function importOptionsWithMocks({ storageSeed = {}, tabsCreateResponder, sendMessageResponder } = {}) {
  const { elements, createdAnchors, document } = createDom();
  const storageMock = createChromeStorageMock({ storageSeed, tabsCreateResponder, sendMessageResponder });

  globalThis.document = document;
  globalThis.chrome = storageMock.chromeMock;

  const moduleUrl = `${pathToFileURL(OPTIONS_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  const optionsModule = await import(moduleUrl);
  await flushAsyncWork();
  await flushAsyncWork();

  return { elements, createdAnchors, optionsModule, ...storageMock };
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
    schemaVersion: 2,
    settings: {
      idleMinutes: 1800,
      excludedHosts: ["example.com", "foo.com", "bar.com"],
      skipPinned: false,
      skipAudible: false,
      siteProfiles: []
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
    schemaVersion: 2,
    settings: {
      idleMinutes: 2700,
      excludedHosts: ["example.com", "*.news.example.com"],
      skipPinned: true,
      skipAudible: true,
      siteProfiles: []
    }
  });
  assert.equal(elements.status.textContent, "Settings saved. Ignored 3 invalid excluded host entries.");
});

test("options page renders and saves site profiles", { concurrency: false }, async () => {
  const { elements, storageData } = await importOptionsWithMocks({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 2,
        settings: {
          idleMinutes: 4320,
          excludedHosts: [],
          skipPinned: true,
          skipAudible: true,
          siteProfiles: [
            {
              id: "site-1",
              hostRule: "example.com",
              overrides: {
                idleMinutes: 120,
                skipPinned: false,
                skipAudible: true,
                excludeFromSuspend: true
              }
            }
          ]
        }
      }
    }
  });

  assert.equal(elements.siteProfiles.children.length, 1);

  elements.addSiteProfileButton.click();
  assert.equal(elements.siteProfiles.children.length, 2);

  const secondRow = elements.siteProfiles.children[1];
  const grid = secondRow.children[0];
  const hostField = grid.children[0];
  const idleField = grid.children[1];
  hostField.children[1].value = "api.example.com";
  idleField.children[1].value = "6";
  const toggles = secondRow.children[1];
  toggles.children[0].children[0].checked = true;
  toggles.children[1].children[0].checked = false;
  toggles.children[2].children[0].checked = false;

  elements.settingsForm.submit();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(storageData[SETTINGS_STORAGE_KEY].schemaVersion, 2);
  assert.equal(storageData[SETTINGS_STORAGE_KEY].settings.siteProfiles.length, 2);
  assert.deepEqual(storageData[SETTINGS_STORAGE_KEY].settings.siteProfiles[0], {
    id: "site-1",
    hostRule: "example.com",
    overrides: {
      idleMinutes: 120,
      skipPinned: false,
      skipAudible: true,
      excludeFromSuspend: true
    }
  });
  assert.equal(storageData[SETTINGS_STORAGE_KEY].settings.siteProfiles[1].hostRule, "api.example.com");
  assert.equal(storageData[SETTINGS_STORAGE_KEY].settings.siteProfiles[1].overrides.idleMinutes, 360);
});

test("invalid site profile rows are ignored with status messaging", { concurrency: false }, async () => {
  const { elements } = await importOptionsWithMocks();

  elements.addSiteProfileButton.click();
  const row = elements.siteProfiles.children[0];
  const grid = row.children[0];
  const hostField = grid.children[0];
  const idleField = grid.children[1];
  hostField.children[1].value = "bad host";
  idleField.children[1].value = "900";

  elements.settingsForm.submit();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(elements.status.textContent, "Settings saved. Ignored 1 invalid site profile entry.");
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
  assert.equal(elements.status.textContent, "Settings loaded.");
  assert.equal(elements.recoveryStatus.textContent, "Reopened suspended tab in a new tab.");
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

test("recovery reopen failure updates recovery status without overwriting settings status", { concurrency: false }, async () => {
  const { elements } = await importOptionsWithMocks({
    storageSeed: {
      [RECOVERY_STORAGE_KEY]: {
        schemaVersion: 1,
        entries: [
          {
            url: "https://example.com/a",
            title: "A",
            suspendedAtMinute: 100
          }
        ]
      }
    },
    tabsCreateResponder() {
      throw new Error("create failed");
    }
  });

  const firstRow = elements.recoveryList.children[0];
  const reopenButton = firstRow.children[1];
  reopenButton.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(elements.status.textContent, "Settings loaded.");
  assert.equal(elements.recoveryStatus.textContent, "Failed to reopen suspended tab.");
  assert.equal(reopenButton.disabled, false);
});

test("diagnostics refresh renders summary and rows", { concurrency: false }, async () => {
  const { elements } = await importOptionsWithMocks({
    sendMessageResponder() {
      return {
        ok: true,
        generatedAtMinute: 123,
        totalTabs: 2,
        truncated: false,
        summary: {
          active: 1,
          pinned: 0,
          audible: 0,
          internalUrl: 0,
          urlTooLong: 0,
          excludedHost: 0,
          timeoutNotReached: 1,
          eligible: 0
        },
        entries: [
          {
            tabId: 5,
            title: "A",
            url: "https://example.com/a",
            reason: "active",
            shouldSuspend: false
          },
          {
            tabId: 6,
            title: "B",
            url: "https://example.com/b",
            reason: "timeoutNotReached",
            shouldSuspend: false
          }
        ]
      };
    }
  });

  elements.refreshDiagnosticsButton.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(elements.diagnosticsStatus.textContent, "Suspension diagnostics updated.");
  assert.equal(elements.diagnosticsSummary.textContent.includes("Evaluated 2 tab(s)."), true);
  assert.equal(elements.diagnosticsList.children.length, 2);
  assert.equal(elements.diagnosticsList.children[0].children[0].textContent, "A");
});

test("diagnostics refresh shows failure message when runtime message fails", { concurrency: false }, async () => {
  const { elements } = await importOptionsWithMocks({
    sendMessageResponder() {
      throw new Error("runtime failure");
    }
  });

  elements.refreshDiagnosticsButton.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(elements.diagnosticsStatus.textContent, "Failed to load suspension diagnostics. runtime failure");
});

test("diagnostics refresh empty/truncated states are rendered", { concurrency: false }, async () => {
  const { elements } = await importOptionsWithMocks({
    sendMessageResponder() {
      return {
        ok: true,
        generatedAtMinute: 321,
        totalTabs: 250,
        truncated: true,
        summary: {
          active: 0,
          pinned: 0,
          audible: 0,
          internalUrl: 0,
          urlTooLong: 0,
          excludedHost: 0,
          timeoutNotReached: 250,
          eligible: 0
        },
        entries: []
      };
    }
  });

  elements.refreshDiagnosticsButton.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(elements.diagnosticsSummary.textContent.includes("Showing first 200 tabs."), true);
  assert.equal(elements.diagnosticsList.children.length, 1);
  assert.equal(elements.diagnosticsList.children[0].children[0].textContent, "No open tabs available for diagnostics.");
});

test("recovery list rerenders rows across updates", { concurrency: false }, async () => {
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

  assert.notEqual(elements.recoveryList.children[0], firstRow);
  assert.notEqual(elements.recoveryList.children[1], secondRow);
});

test("recovery list rerender reflects changed entry content", { concurrency: false }, async () => {
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

  const secondRow = elements.recoveryList.children[1];
  const secondRowDetails = secondRow.children[0];
  const secondRowTitle = secondRowDetails.children[0];

  assert.equal(secondRowTitle.textContent, "Updated");
});

test("export action creates downloadable json file with expected name prefix", { concurrency: false }, async () => {
  const { elements, createdAnchors } = await importOptionsWithMocks({
    storageSeed: {
      [SETTINGS_STORAGE_KEY]: {
        schemaVersion: 2,
        settings: {
          idleMinutes: 120,
          excludedHosts: ["example.com"],
          skipPinned: true,
          skipAudible: true,
          siteProfiles: []
        }
      },
      [RECOVERY_STORAGE_KEY]: {
        schemaVersion: 1,
        entries: [{ url: "https://example.com/a", title: "A", suspendedAtMinute: 10 }]
      }
    }
  });

  elements.exportConfigButton.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(createdAnchors.length, 1);
  assert.equal(createdAnchors[0].download.startsWith("tab-suspender-config-"), true);
  assert.equal(createdAnchors[0].download.endsWith(".json"), true);
  assert.equal(createdAnchors[0].href.startsWith("data:application/json"), true);
  assert.equal(decodeURIComponent(createdAnchors[0].href).includes('\"exportSchemaVersion\": 1'), true);
  assert.equal(elements.importExportStatus.textContent, "Export started.");
});

test("import rejects invalid payload without writing storage", { concurrency: false }, async () => {
  const { elements, storageSetCalls } = await importOptionsWithMocks();

  elements.importConfigFile.files = [
    {
      text: async () => "{invalid"
    }
  ];
  elements.importConfigFile.dispatch("change");
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(storageSetCalls.length, 0);
  assert.equal(elements.importPreview.hidden, true);
  assert.equal(elements.importExportStatus.textContent, "Failed to import configuration. Invalid JSON file.");
});

test("import valid payload shows preview and does not write until apply", { concurrency: false }, async () => {
  const { elements, storageSetCalls } = await importOptionsWithMocks();

  elements.importConfigFile.files = [
    {
      text: async () =>
        JSON.stringify({
          exportSchemaVersion: 1,
          generatedAtMinute: 100,
          settings: {
            idleMinutes: 180,
            excludedHosts: ["example.com", "bad host"],
            skipPinned: false,
            skipAudible: true,
            siteProfiles: []
          },
          recoveryState: {
            schemaVersion: 1,
            entries: [{ url: "https://example.com/a", title: "A", suspendedAtMinute: 90 }]
          }
        })
    }
  ];
  elements.importConfigFile.dispatch("change");
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(storageSetCalls.length, 0);
  assert.equal(elements.importPreview.hidden, false);
  assert.equal(elements.applyImportButton.disabled, false);
  assert.equal(elements.importExportStatus.textContent, "Configuration ready to import.");
});

test("apply import writes settings and recovery in one storage set and rerenders ui", { concurrency: false }, async () => {
  const { elements, storageSetCalls, storageData } = await importOptionsWithMocks();

  elements.importConfigFile.files = [
    {
      text: async () =>
        JSON.stringify({
          exportSchemaVersion: 1,
          generatedAtMinute: 100,
          settings: {
            idleMinutes: 180,
            excludedHosts: ["example.com"],
            skipPinned: false,
            skipAudible: true,
            siteProfiles: []
          },
          recoveryState: {
            schemaVersion: 1,
            entries: [{ url: "https://example.com/a", title: "A", suspendedAtMinute: 90 }]
          }
        })
    }
  ];
  elements.importConfigFile.dispatch("change");
  await flushAsyncWork();
  await flushAsyncWork();

  elements.applyImportButton.click();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(storageSetCalls.length, 1);
  assert.deepEqual(Object.keys(storageSetCalls[0]).sort(), [RECOVERY_STORAGE_KEY, SETTINGS_STORAGE_KEY]);
  assert.deepEqual(storageData[SETTINGS_STORAGE_KEY], {
    schemaVersion: 2,
    settings: {
      idleMinutes: 180,
      excludedHosts: ["example.com"],
      skipPinned: false,
      skipAudible: true,
      siteProfiles: []
    }
  });
  assert.deepEqual(storageData[RECOVERY_STORAGE_KEY], {
    schemaVersion: 1,
    entries: [{ url: "https://example.com/a", title: "A", suspendedAtMinute: 90 }]
  });
  assert.equal(elements.idleHours.value, "3");
  assert.equal(elements.recoveryList.children.length, 1);
  assert.equal(elements.importPreview.hidden, true);
  assert.equal(elements.importExportStatus.textContent, "Imported configuration applied.");
});

test("cancel import clears staged preview without writing storage", { concurrency: false }, async () => {
  const { elements, storageSetCalls } = await importOptionsWithMocks();

  elements.importConfigFile.files = [
    {
      text: async () =>
        JSON.stringify({
          exportSchemaVersion: 1,
          generatedAtMinute: 100,
          settings: {
            idleMinutes: 180,
            excludedHosts: ["example.com"],
            skipPinned: false,
            skipAudible: true,
            siteProfiles: []
          },
          recoveryState: {
            schemaVersion: 1,
            entries: [{ url: "https://example.com/a", title: "A", suspendedAtMinute: 90 }]
          }
        })
    }
  ];
  elements.importConfigFile.dispatch("change");
  await flushAsyncWork();
  await flushAsyncWork();

  elements.cancelImportButton.click();

  assert.equal(storageSetCalls.length, 0);
  assert.equal(elements.importPreview.hidden, true);
  assert.equal(elements.applyImportButton.disabled, true);
  assert.equal(elements.importExportStatus.textContent, "Import canceled.");
});

test.afterEach(() => {
  if (REAL_DOCUMENT === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = REAL_DOCUMENT;
  }

  delete globalThis.chrome;
});
