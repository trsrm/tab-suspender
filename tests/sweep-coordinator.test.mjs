import test from "node:test";
import assert from "node:assert/strict";
import { createSweepCoordinator } from "../build/extension/background/sweep-coordinator.js";

function createDeferred() {
  let resolve;

  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve
  };
}

test("coordinator bounds in-flight catch-up to one latest pending minute", { concurrency: false }, async () => {
  const firstSweepGate = createDeferred();
  const runMinutes = [];

  const coordinator = createSweepCoordinator({
    async runSweep(minute) {
      runMinutes.push(minute);

      if (minute === 10) {
        await firstSweepGate.promise;
      }
    },
    onSweepError() {
      throw new Error("unexpected sweep error");
    }
  });

  const firstRequest = coordinator.requestSweep(10);
  coordinator.requestSweep(11);
  coordinator.requestSweep(15);

  firstSweepGate.resolve();
  await firstRequest;

  assert.deepEqual(runMinutes, [10, 15]);
});

test("coordinator clears pending catch-up minute after first-run failure", { concurrency: false }, async () => {
  const firstSweepGate = createDeferred();
  const runMinutes = [];
  const errors = [];

  const coordinator = createSweepCoordinator({
    async runSweep(minute) {
      runMinutes.push(minute);

      if (minute === 20) {
        await firstSweepGate.promise;
        throw new Error("first run failed");
      }
    },
    onSweepError(error) {
      errors.push(error);
    }
  });

  const firstRequest = coordinator.requestSweep(20);
  coordinator.requestSweep(25);

  firstSweepGate.resolve();
  await firstRequest;

  assert.equal(errors.length, 1);
  assert.deepEqual(runMinutes, [20]);

  await coordinator.requestSweep(26);
  assert.deepEqual(runMinutes, [20, 26]);
});

test("coordinator reports catch-up failure and keeps future requests independent", { concurrency: false }, async () => {
  const runMinutes = [];
  const errors = [];

  const coordinator = createSweepCoordinator({
    async runSweep(minute) {
      runMinutes.push(minute);

      if (minute === 33) {
        throw new Error("catch-up failed");
      }
    },
    onSweepError(error) {
      errors.push(error);
    }
  });

  const firstRequest = coordinator.requestSweep(30);
  coordinator.requestSweep(33);
  await firstRequest;

  assert.equal(errors.length, 1);
  assert.deepEqual(runMinutes, [30, 33]);

  await coordinator.requestSweep(34);
  assert.deepEqual(runMinutes, [30, 33, 34]);
});
