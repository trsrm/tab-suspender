import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BROWSER_COMPAT_MODULE_PATH = path.resolve("build/extension/browser-compat.js");

function createChromeMock({
  queryImpl,
  updateImpl,
  createImpl,
  sendMessageImpl
} = {}) {
  const chromeMock = {
    runtime: {
      lastError: undefined,
      sendMessage(message, callback) {
        if (!sendMessageImpl) {
          callback?.(undefined);
          return undefined;
        }

        return sendMessageImpl(message, callback, chromeMock);
      }
    },
    tabs: {
      query(queryInfo, callback) {
        if (!queryImpl) {
          callback?.([]);
          return undefined;
        }

        return queryImpl(queryInfo, callback, chromeMock);
      },
      update(tabId, updateProperties, callback) {
        if (!updateImpl) {
          callback?.(undefined);
          return undefined;
        }

        return updateImpl(tabId, updateProperties, callback, chromeMock);
      },
      create(createProperties, callback) {
        if (!createImpl) {
          callback?.(undefined);
          return undefined;
        }

        return createImpl(createProperties, callback, chromeMock);
      }
    }
  };

  return chromeMock;
}

async function importBrowserCompatWithMock(chromeMock) {
  globalThis.chrome = chromeMock;
  const moduleUrl = `${pathToFileURL(BROWSER_COMPAT_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

test("queryTabsWithCompat supports callback APIs", { concurrency: false }, async () => {
  const module = await importBrowserCompatWithMock(
    createChromeMock({
      queryImpl(_queryInfo, callback) {
        callback([{ id: 1 }, { id: 2 }]);
      }
    })
  );

  const tabs = await module.queryTabsWithCompat({ active: true });
  assert.deepEqual(tabs, [{ id: 1 }, { id: 2 }]);
});

test("queryTabsWithCompat supports promise APIs", { concurrency: false }, async () => {
  const module = await importBrowserCompatWithMock(
    createChromeMock({
      queryImpl() {
        return Promise.resolve([{ id: 3 }]);
      }
    })
  );

  const tabs = await module.queryTabsWithCompat({ active: false });
  assert.deepEqual(tabs, [{ id: 3 }]);
});

test("queryTabsWithCompat rejects on runtime.lastError", { concurrency: false }, async () => {
  const module = await importBrowserCompatWithMock(
    createChromeMock({
      queryImpl(_queryInfo, callback, chromeMock) {
        chromeMock.runtime.lastError = { message: "query failed" };
        callback(undefined);
        chromeMock.runtime.lastError = undefined;
      }
    })
  );

  await assert.rejects(() => module.queryTabsWithCompat({}), /query failed/);
});

test("updateTabWithCompat supports callback and promise APIs", { concurrency: false }, async () => {
  const callbackModule = await importBrowserCompatWithMock(
    createChromeMock({
      updateImpl(_tabId, _updateProperties, callback) {
        callback(undefined);
      }
    })
  );

  await callbackModule.updateTabWithCompat(1, { url: "https://example.com" });

  const promiseModule = await importBrowserCompatWithMock(
    createChromeMock({
      updateImpl() {
        return Promise.resolve(undefined);
      }
    })
  );

  await promiseModule.updateTabWithCompat(2, { active: true });
});

test("createTabWithCompat rejects on runtime.lastError", { concurrency: false }, async () => {
  const module = await importBrowserCompatWithMock(
    createChromeMock({
      createImpl(_createProperties, callback, chromeMock) {
        chromeMock.runtime.lastError = { message: "create failed" };
        callback(undefined);
        chromeMock.runtime.lastError = undefined;
      }
    })
  );

  await assert.rejects(() => module.createTabWithCompat("https://example.com"), /create failed/);
});

test("sendRuntimeMessageWithCompat supports callback and promise APIs", { concurrency: false }, async () => {
  const callbackModule = await importBrowserCompatWithMock(
    createChromeMock({
      sendMessageImpl(_message, callback) {
        callback({ ok: true, from: "callback" });
      }
    })
  );

  const callbackResponse = await callbackModule.sendRuntimeMessageWithCompat({ type: "PING" });
  assert.deepEqual(callbackResponse, { ok: true, from: "callback" });

  const promiseModule = await importBrowserCompatWithMock(
    createChromeMock({
      sendMessageImpl() {
        return Promise.resolve({ ok: true, from: "promise" });
      }
    })
  );

  const promiseResponse = await promiseModule.sendRuntimeMessageWithCompat({ type: "PING" });
  assert.deepEqual(promiseResponse, { ok: true, from: "promise" });
});

test("sendRuntimeMessageWithCompat rejects when runtime messaging is unavailable", { concurrency: false }, async () => {
  globalThis.chrome = { tabs: {} };
  const moduleUrl = `${pathToFileURL(BROWSER_COMPAT_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  const module = await import(moduleUrl);

  await assert.rejects(() => module.sendRuntimeMessageWithCompat({ type: "PING" }), /Runtime messaging is unavailable/);
});

test.afterEach(() => {
  delete globalThis.chrome;
});
