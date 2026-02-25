# Plan 13 - Reliable Auto-Suspend Timeout (Focus-Based + Restart-Safe)

## Status
Implemented

## Goal
Ensure automatic suspension is based on unfocused duration, survives service-worker restarts, and does not let unfocused background updates indefinitely extend timeout eligibility.

## Scope
- Persist background activity state in versioned local storage.
- Define timeout semantics around focus transitions (switch-away starts idle timer).
- Ensure sweep/runtime hydration includes persisted activity before eligibility decisions.
- Prevent inactive tab `onUpdated` churn from resetting idle reference timestamps.
- Add deterministic tests for restart durability and baseline fallback behavior.

## Implementation Steps
1. Added `StoredActivityStateV1` schema types and new `activity-store.ts` for load/save/decode/sanitize storage handling with callback/Promise compatibility.
2. Refactored background runtime state management to hydrate settings and activity before suspension paths run.
3. Added per-window active-tab tracking and focused-window semantics so focus switches mark previous tab inactivity start minute.
4. Added conservative baseline activity initialization for tabs missing records during sweep so they become eligible after one full timeout interval.
5. Added queued activity persistence for state-changing events (activate/focus/remove/replace/suspend/startup prune/seed).
6. Adjusted `tabs.onUpdated` handling to apply only to meaningful active-tab updates.
7. Added/updated tests for focus-based timeout behavior, inactive update immunity, missing activity baseline behavior, restart durability, and invalid persisted activity payload fallback.
8. Updated user-facing troubleshooting docs and roadmap/decision log entries for the new timeout semantics.

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/activity-store.ts`
- `extension/src/background.ts`
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `tests/settings-runtime.test.mjs`
- `README.md`
- `ROADMAP.md`
- `docs/architecture.md`
- `docs/plans/README.md`
- `docs/plans/plan-13-reliable-auto-suspend-timeout.md`

## Tests/Evidence
- Command: `npm run build && node --test tests/background-event-wiring.test.mjs tests/suspend-action.test.mjs tests/settings-runtime.test.mjs`
  - Result: passed (25 tests, 0 failures), including Plan 13 focus-switch timing, restart durability, baseline fallback, and inactive update behavior.
- Command: `npm run test`
  - Result: passed (65 tests, 0 failures).
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).

## Exit Criteria
- Unfocused timeout basis is deterministic and starts when focus leaves a tab.
- Service-worker restart does not require tab reactivation to preserve auto-suspend behavior.
- Missing activity no longer causes indefinite non-suspension; baseline allows eligibility after one full timeout interval.
- Existing safety guards (active/pinned/audible/internal/excluded/url length) remain enforced.
- Regression suites remain green.

## Rollback
- Revert Plan 13 changes in:
  - `extension/src/types.ts`
  - `extension/src/activity-store.ts`
  - `extension/src/background.ts`
  - `tests/background-event-wiring.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `tests/settings-runtime.test.mjs`
  - `README.md`
  - `ROADMAP.md`
  - `docs/plans/README.md`
  - `docs/plans/plan-13-reliable-auto-suspend-timeout.md`
  - Rebuild runtime outputs with `npm run build`

## Decisions
- Idle timeout semantics are defined as time since tab lost focus (not any passive tab update).
- Active tabs remain protected from automatic suspension across windows.
- Missing activity records initialize conservatively at sweep time (`nowMinute`) to avoid indefinite `timeoutNotReached`.
- Activity persistence uses a versioned envelope under a dedicated storage key with bounded, deduped records.

## Retrospective
- What changed: auto-suspend now starts from focus loss, survives worker restarts via persisted activity state, and ignores inactive update churn that previously delayed suspension.
- Risks left: final confidence still depends on manual Safari smoke validation because Node tests cannot emulate full Safari lifecycle timing and UI behavior.
