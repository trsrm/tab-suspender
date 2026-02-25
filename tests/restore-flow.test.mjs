import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUSPENDED_MODULE_PATH = path.resolve("build/extension/suspended.js");
const URL_SAFETY_MODULE_PATH = path.resolve("build/extension/url-safety.js");
const REAL_LOCATION = globalThis.location;
const REAL_DOCUMENT = globalThis.document;

function createElement() {
  const listeners = new Map();

  return {
    textContent: "",
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

async function importSuspendedWithSearch(search, { replaceImpl } = {}) {
  const elements = {
    title: createElement(),
    summary: createElement(),
    capturedAt: createElement(),
    status: createElement(),
    restoreButton: createElement()
  };

  const replaceCalls = [];
  globalThis.location = {
    search,
    replace(url) {
      replaceCalls.push(url);

      if (typeof replaceImpl === "function") {
        replaceImpl(url);
      }
    }
  };
  globalThis.document = {
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };

  const moduleUrl = `${pathToFileURL(SUSPENDED_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  await import(moduleUrl);

  return { elements, replaceCalls };
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

  const { elements, replaceCalls } = await importSuspendedWithSearch(`?${params.toString()}`);

  assert.equal(elements.title.textContent, "Saved Title");
  assert.equal(elements.summary.textContent, "Original tab: example.com");
  assert.equal(elements.capturedAt.textContent, "Captured at 1970-01-01 11:40 UTC.");
  assert.equal(elements.status.textContent, "Ready to restore this tab.");
  assert.equal(elements.restoreButton.disabled, false);

  elements.restoreButton.click();

  assert.deepEqual(replaceCalls, ["https://example.com/path?q=1"]);
  assert.equal(elements.status.textContent, "Restoring tab...");
  assert.equal(elements.restoreButton.disabled, true);
});

test("suspended page keeps restore disabled for missing payload URL", { concurrency: false }, async () => {
  const { elements, replaceCalls } = await importSuspendedWithSearch("?t=Saved&ts=700");

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

  assert.equal(elements.status.textContent, "Cannot restore: original URL is too long.");
  assert.equal(elements.restoreButton.disabled, true);
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
});
