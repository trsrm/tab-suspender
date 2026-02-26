import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TIME_FORMAT_MODULE_PATH = path.resolve("build/extension/time-format.js");
const REAL_DATE = globalThis.Date;

async function importTimeFormatModule() {
  const moduleUrl = `${pathToFileURL(TIME_FORMAT_MODULE_PATH).href}?test=${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

test("formatCapturedAtMinuteUtc formats valid minute values in UTC", { concurrency: false }, async () => {
  const { formatCapturedAtMinuteUtc } = await importTimeFormatModule();
  assert.equal(formatCapturedAtMinuteUtc(700), "Captured at 1970-01-01 11:40 UTC.");
});

test("formatCapturedAtMinuteUtc returns unavailable message for non-positive or non-finite values", { concurrency: false }, async () => {
  const { formatCapturedAtMinuteUtc } = await importTimeFormatModule();
  assert.equal(formatCapturedAtMinuteUtc(0), "Capture time unavailable.");
  assert.equal(formatCapturedAtMinuteUtc(Number.NaN), "Capture time unavailable.");
});

test("formatCapturedAtMinuteUtc falls back to minute text when Date formatting throws", { concurrency: false }, async () => {
  const { formatCapturedAtMinuteUtc } = await importTimeFormatModule();

  class BrokenDate extends REAL_DATE {
    toISOString() {
      throw new Error("forced date failure");
    }
  }

  globalThis.Date = BrokenDate;

  try {
    assert.equal(formatCapturedAtMinuteUtc(700), "Captured at minute 700.");
  } finally {
    globalThis.Date = REAL_DATE;
  }
});
