import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUSPENDED_MODULE_PATH = path.resolve("build/extension/suspended.js");
const URL_SAFETY_MODULE_PATH = path.resolve("build/extension/url-safety.js");
const REAL_LOCATION = globalThis.location;
const REAL_DOCUMENT = globalThis.document;
const REAL_NAVIGATOR_DESCRIPTOR = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function createElement() {
  const listeners = new Map();

  return {
    textContent: "",
    title: "",
    disabled: false,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    click() {
      const listener = listeners.get("click");

      if (typeof listener === "function") {
        listener();
      }
    }
  };
}

async function importUrlSafety() {
  const moduleUrl = `${pathToFileURL(URL_SAFETY_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

function setNavigatorMock(navigatorValue) {
  Object.defineProperty(globalThis, "navigator", {
    value: navigatorValue,
    configurable: true,
    writable: true
  });
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function importSuspendedWithSearch(search, { replaceImpl, withClipboard = true, clipboardWriteImpl } = {}) {
  const elements = {
    title: createElement(),
    originalUrl: createElement(),
    copyStatus: createElement(),
    capturedAt: createElement(),
    status: createElement(),
    restoreButton: createElement()
  };

  const replaceCalls = [];
  const clipboardCalls = [];

  if (withClipboard) {
    setNavigatorMock({
      clipboard: {
        writeText(text) {
          clipboardCalls.push(text);

          if (typeof clipboardWriteImpl === "function") {
            return clipboardWriteImpl(text);
          }

          return Promise.resolve();
        }
      }
    });
  } else {
    setNavigatorMock({});
  }

  globalThis.location = {
    search,
    replace(url) {
      replaceCalls.push(url);

      if (typeof replaceImpl === "function") {
        replaceImpl(url);
      }
    }
  };
  const documentState = {
    title: "Tab Suspended",
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };
  globalThis.document = documentState;

  const moduleUrl = `${pathToFileURL(SUSPENDED_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  await import(moduleUrl);

  return { elements, replaceCalls, clipboardCalls, documentState };
}

test("url safety validator enforces protocol and max length", { concurrency: false }, async () => {
  const { MAX_RESTORABLE_URL_LENGTH, validateRestorableUrl } = await importUrlSafety();

  assert.equal(MAX_RESTORABLE_URL_LENGTH, 2048);
  assert.deepEqual(validateRestorableUrl("  https://example.com/path?q=1  "), {
    ok: true,
    url: "https://example.com/path?q=1"
  });
  assert.deepEqual(validateRestorableUrl(undefined), { ok: false, reason: "missing" });
  assert.deepEqual(validateRestorableUrl(""), { ok: false, reason: "missing" });
  assert.deepEqual(validateRestorableUrl(`https://example.com/${"a".repeat(2100)}`), {
    ok: false,
    reason: "tooLong"
  });
  assert.deepEqual(validateRestorableUrl("javascript:alert(1)"), {
    ok: false,
    reason: "invalidProtocol"
  });
  assert.deepEqual(validateRestorableUrl("not-a-valid-url"), {
    ok: false,
    reason: "invalidUrl"
  });
});

test("suspended page enables restore for valid payload and navigates on click", { concurrency: false }, async () => {
  const params = new URLSearchParams({
    u: "https://example.com/path?q=1",
    t: "   Saved Title   ",
    ts: "700"
  });

  const { elements, replaceCalls, clipboardCalls, documentState } = await importSuspendedWithSearch(
    `?${params.toString()}`
  );

  assert.equal(elements.title.textContent, "Saved Title");
  assert.equal(documentState.title, "Saved Title");
  assert.equal(elements.originalUrl.textContent, "https://example.com/path?q=1");
  assert.equal(elements.originalUrl.title, "https://example.com/path?q=1");
  assert.equal(elements.capturedAt.textContent, "Captured at 1970-01-01 11:40 UTC.");
  assert.equal(elements.status.textContent, "Ready to restore this tab.");
  assert.equal(elements.copyStatus.textContent, "");
  assert.equal(elements.originalUrl.disabled, false);
  assert.equal(elements.restoreButton.disabled, false);

  elements.originalUrl.click();
  await flushAsyncWork();

  assert.deepEqual(clipboardCalls, ["https://example.com/path?q=1"]);
  assert.equal(elements.copyStatus.textContent, "Original URL copied to clipboard.");

  elements.restoreButton.click();

  assert.deepEqual(replaceCalls, ["https://example.com/path?q=1"]);
  assert.equal(elements.status.textContent, "Restoring tab...");
  assert.equal(elements.restoreButton.disabled, true);
});

test("suspended page crops document title and falls back to default heading", { concurrency: false }, async () => {
  const params = new URLSearchParams({
    u: "https://example.com/path?q=1",
    t: " ".repeat(2),
    ts: "700"
  });

  const { elements, documentState } = await importSuspendedWithSearch(`?${params.toString()}`);
  assert.equal(elements.title.textContent, "Suspended tab");
  assert.equal(documentState.title, "Suspended tab");

  const longTitle = "A".repeat(120);
  const longParams = new URLSearchParams({
    u: "https://example.com/path?q=1",
    t: longTitle,
    ts: "700"
  });
  const longResult = await importSuspendedWithSearch(`?${longParams.toString()}`);

  assert.equal(longResult.elements.title.textContent.length, 120);
  assert.equal(longResult.documentState.title.length, 80);
});

test("suspended page keeps restore disabled for missing payload URL", { concurrency: false }, async () => {
  const { elements, replaceCalls } = await importSuspendedWithSearch("?t=Saved&ts=700");

  assert.equal(elements.originalUrl.textContent, "Original URL is unavailable.");
  assert.equal(elements.originalUrl.disabled, true);
  assert.equal(elements.status.textContent, "Cannot restore: missing original URL.");
  assert.equal(elements.restoreButton.disabled, true);
  elements.restoreButton.click();
  assert.deepEqual(replaceCalls, []);
});

test("suspended page keeps restore disabled for invalid protocol URL", { concurrency: false }, async () => {
  const params = new URLSearchParams({
    u: "safari-extension://abc/suspended.html",
    t: "Saved",
    ts: "700"
  });

  const { elements } = await importSuspendedWithSearch(`?${params.toString()}`);

  assert.equal(elements.originalUrl.textContent, "safari-extension://abc/suspended.html");
  assert.equal(elements.status.textContent, "Cannot restore: original URL protocol is not supported.");
  assert.equal(elements.restoreButton.disabled, true);
});

test("suspended page keeps restore disabled for oversized URL payload", { concurrency: false }, async () => {
  const params = new URLSearchParams({
    u: `https://example.com/${"a".repeat(2100)}`,
    t: "Saved",
    ts: "700"
  });

  const { elements } = await importSuspendedWithSearch(`?${params.toString()}`);

  assert.equal(elements.originalUrl.textContent, `https://example.com/${"a".repeat(2100)}`);
  assert.equal(elements.status.textContent, "Cannot restore: original URL is too long.");
  assert.equal(elements.restoreButton.disabled, true);
});

test("suspended page handles clipboard failures without affecting restore status", { concurrency: false }, async () => {
  const params = new URLSearchParams({
    u: "https://example.com/failure",
    t: "Saved",
    ts: "700"
  });

  const withoutClipboard = await importSuspendedWithSearch(`?${params.toString()}`, {
    withClipboard: false
  });
  withoutClipboard.elements.originalUrl.click();

  assert.equal(withoutClipboard.elements.copyStatus.textContent, "Could not copy URL. Copy manually.");

  const withFailureClipboard = await importSuspendedWithSearch(`?${params.toString()}`, {
    clipboardWriteImpl() {
      return Promise.reject(new Error("clipboard unavailable"));
    }
  });
  withFailureClipboard.elements.originalUrl.click();
  await flushAsyncWork();

  assert.equal(withFailureClipboard.elements.copyStatus.textContent, "Could not copy URL. Copy manually.");
  assert.equal(withFailureClipboard.elements.status.textContent, "Ready to restore this tab.");
  assert.equal(withFailureClipboard.elements.restoreButton.disabled, false);
});

test("suspended page surfaces restore failure without breaking state", { concurrency: false }, async () => {
  const params = new URLSearchParams({
    u: "https://example.com/failure",
    t: "Saved",
    ts: "700"
  });

  const { elements, replaceCalls } = await importSuspendedWithSearch(`?${params.toString()}`, {
    replaceImpl() {
      throw new Error("simulated navigation failure");
    }
  });

  elements.restoreButton.click();

  assert.deepEqual(replaceCalls, ["https://example.com/failure"]);
  assert.equal(elements.status.textContent, "Restore failed. Please try again.");
  assert.equal(elements.restoreButton.disabled, false);
});

test.afterEach(() => {
  if (REAL_LOCATION === undefined) {
    delete globalThis.location;
  } else {
    globalThis.location = REAL_LOCATION;
  }

  if (REAL_DOCUMENT === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = REAL_DOCUMENT;
  }

  if (REAL_NAVIGATOR_DESCRIPTOR === undefined) {
    delete globalThis.navigator;
  } else {
    Object.defineProperty(globalThis, "navigator", REAL_NAVIGATOR_DESCRIPTOR);
  }
});
