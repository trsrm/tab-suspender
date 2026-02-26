import test from "node:test";
import assert from "node:assert/strict";

import { evaluateSuspendDecision, isInternalUrl } from "../build/extension/policy.js";

const BASE_INPUT = Object.freeze({
  tab: {
    active: false,
    pinned: false,
    audible: false,
    url: "https://example.com/page"
  },
  activity: {
    lastActiveAtMinute: 100,
    lastUpdatedAtMinute: 100
  },
  settings: {
    idleMinutes: 60,
    excludedHosts: [],
    skipPinned: true,
    skipAudible: true
  },
  nowMinute: 160,
  flags: {
    excludedHost: false,
    urlTooLong: false
  }
});

function createInput(overrides = {}) {
  return {
    tab: {
      ...BASE_INPUT.tab,
      ...overrides.tab
    },
    activity:
      overrides.activity === undefined
        ? { ...BASE_INPUT.activity }
        : overrides.activity,
    settings: {
      ...BASE_INPUT.settings,
      ...overrides.settings
    },
    nowMinute: overrides.nowMinute ?? BASE_INPUT.nowMinute,
    flags:
      overrides.flags === undefined
        ? { ...BASE_INPUT.flags }
        : overrides.flags
  };
}

const reasonCases = [
  {
    name: "eligible",
    input: createInput(),
    expected: { shouldSuspend: true, reason: "eligible" }
  },
  {
    name: "active",
    input: createInput({ tab: { active: true } }),
    expected: { shouldSuspend: false, reason: "active" }
  },
  {
    name: "pinned",
    input: createInput({ tab: { pinned: true } }),
    expected: { shouldSuspend: false, reason: "pinned" }
  },
  {
    name: "audible",
    input: createInput({ tab: { audible: true } }),
    expected: { shouldSuspend: false, reason: "audible" }
  },
  {
    name: "internalUrl",
    input: createInput({ tab: { url: "safari-extension://abc123/suspended.html" } }),
    expected: { shouldSuspend: false, reason: "internalUrl" }
  },
  {
    name: "urlTooLong",
    input: createInput({ flags: { urlTooLong: true } }),
    expected: { shouldSuspend: false, reason: "urlTooLong" }
  },
  {
    name: "excludedHost",
    input: createInput({ flags: { excludedHost: true } }),
    expected: { shouldSuspend: false, reason: "excludedHost" }
  },
  {
    name: "timeoutNotReached",
    input: createInput({ nowMinute: 159 }),
    expected: { shouldSuspend: false, reason: "timeoutNotReached" }
  }
];

for (const reasonCase of reasonCases) {
  test(`decision matrix: ${reasonCase.name}`, () => {
    const decision = evaluateSuspendDecision(reasonCase.input);
    assert.deepEqual(decision, reasonCase.expected);
  });
}

test("precedence: active dominates pinned and audible", () => {
  const decision = evaluateSuspendDecision(
    createInput({
      tab: { active: true, pinned: true, audible: true }
    })
  );

  assert.deepEqual(decision, { shouldSuspend: false, reason: "active" });
});

test("precedence: pinned dominates audible when skipPinned is enabled", () => {
  const decision = evaluateSuspendDecision(
    createInput({
      tab: { pinned: true, audible: true }
    })
  );

  assert.deepEqual(decision, { shouldSuspend: false, reason: "pinned" });
});

test("precedence: internalUrl dominates urlTooLong and excludedHost flags", () => {
  const decision = evaluateSuspendDecision(
    createInput({
      tab: { url: "about:blank" },
      flags: { urlTooLong: true, excludedHost: true }
    })
  );

  assert.deepEqual(decision, { shouldSuspend: false, reason: "internalUrl" });
});

test("internalUrl flag is honored without re-parsing tab url", () => {
  const decision = evaluateSuspendDecision(
    createInput({
      tab: { url: "https://example.com/valid" },
      flags: { internalUrl: true, urlTooLong: false, excludedHost: false }
    })
  );

  assert.deepEqual(decision, { shouldSuspend: false, reason: "internalUrl" });
});

test("idle boundary: exact threshold is eligible, one minute below is not", () => {
  const exactlyAtThreshold = evaluateSuspendDecision(
    createInput({
      nowMinute: 160,
      settings: { idleMinutes: 60 },
      activity: { lastActiveAtMinute: 100, lastUpdatedAtMinute: 100 }
    })
  );

  const oneMinuteBelowThreshold = evaluateSuspendDecision(
    createInput({
      nowMinute: 159,
      settings: { idleMinutes: 60 },
      activity: { lastActiveAtMinute: 100, lastUpdatedAtMinute: 100 }
    })
  );

  assert.deepEqual(exactlyAtThreshold, { shouldSuspend: true, reason: "eligible" });
  assert.deepEqual(oneMinuteBelowThreshold, { shouldSuspend: false, reason: "timeoutNotReached" });
});

test("idle basis uses max(lastActiveAtMinute, lastUpdatedAtMinute)", () => {
  const decision = evaluateSuspendDecision(
    createInput({
      activity: { lastActiveAtMinute: 100, lastUpdatedAtMinute: 130 },
      nowMinute: 189,
      settings: { idleMinutes: 60 }
    })
  );

  assert.deepEqual(decision, { shouldSuspend: false, reason: "timeoutNotReached" });
});

test("settings toggles allow pinned and audible tabs when disabled", () => {
  const pinnedAllowed = evaluateSuspendDecision(
    createInput({
      tab: { pinned: true },
      settings: { skipPinned: false }
    })
  );

  const audibleAllowed = evaluateSuspendDecision(
    createInput({
      tab: { audible: true },
      settings: { skipAudible: false }
    })
  );

  assert.deepEqual(pinnedAllowed, { shouldSuspend: true, reason: "eligible" });
  assert.deepEqual(audibleAllowed, { shouldSuspend: true, reason: "eligible" });
});

test("missing activity defaults to timeoutNotReached", () => {
  const decision = evaluateSuspendDecision(
    createInput({
      activity: null
    })
  );

  assert.deepEqual(decision, { shouldSuspend: false, reason: "timeoutNotReached" });
});

test("evaluator is deterministic and does not depend on Date.now", () => {
  const realDateNow = Date.now;
  const input = createInput();
  const first = evaluateSuspendDecision(input);
  let second;
  let third;

  try {
    Date.now = () => 0;
    second = evaluateSuspendDecision(input);

    Date.now = () => 999_999_999_999;
    third = evaluateSuspendDecision(input);
  } finally {
    Date.now = realDateNow;
  }

  assert.deepEqual(first, { shouldSuspend: true, reason: "eligible" });
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
});

test("isInternalUrl helper only allows http(s)", () => {
  assert.equal(isInternalUrl("https://example.com"), false);
  assert.equal(isInternalUrl("http://example.com"), false);
  assert.equal(isInternalUrl("about:blank"), true);
  assert.equal(isInternalUrl("safari-extension://id/page"), true);
  assert.equal(isInternalUrl("not a url"), true);
  assert.equal(isInternalUrl(""), true);
  assert.equal(isInternalUrl(undefined), true);
});
