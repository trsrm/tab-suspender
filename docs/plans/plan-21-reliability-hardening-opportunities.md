# Plan 21 - Reliability Hardening Opportunities

## Status
Implemented

## Goal
Strengthen failure handling and state consistency across background lifecycle events without changing suspend-policy behavior, storage schema, or permissions.

## Scope
- Deterministic settings transition ordering across startup hydration and live `storage.onChanged` updates.
- Bounded retry/backoff for activity/recovery persistence queues.
- Sweep coordinator failure-path invariants and explicit race/failure regression tests.

## Non-goals
- No policy precedence or eligibility logic changes.
- No options/suspended UI workflow changes.
- No storage key/version changes.

## Implementation Steps
1. Added a monotonic settings transition epoch in `background.ts` and routed hydration/live updates through guarded commit logic.
2. Ensured sweep cadence realignment only runs for committed settings transitions (stale hydration results are ignored).
3. Extended `createPersistQueue` with bounded retry defaults (`maxRetries=2`, `baseRetryDelayMs=50`) and injectable sleep for deterministic testing.
4. Added retry metadata (`attempt`, `willRetry`, `terminal`) to persistence error callbacks and updated background logging to include retry context.
5. Hardened sweep coordinator invariants by defensively clearing stale pending catch-up state before new independent runs and on failure.
6. Extended background harness to support controllable storage-get sequencing for hydration/onChanged interleaving tests.
7. Added/updated tests for:
   - hydration vs onChanged interleaving winner
   - transient persistence failure recovery without new events
   - bounded terminal retry behavior (no infinite retry loop)
   - sweep coordinator failure and catch-up invariants

## Files Added/Changed
- `extension/src/background.ts`
- `extension/src/background/persist-queue.ts`
- `extension/src/background/sweep-coordinator.ts`
- `tests/helpers/background-harness.mjs`
- `tests/settings-runtime.test.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/sweep-coordinator.test.mjs`
- `docs/plans/plan-21-reliability-hardening-opportunities.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `node --test tests/settings-runtime.test.mjs tests/background-event-wiring.test.mjs tests/sweep-coordinator.test.mjs`
  - Result: passed (22 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (93 tests, 0 failures).

## Exit Criteria
- Startup hydration and live settings updates resolve deterministically (newer transition wins).
- Persistence queues recover from transient storage failures via bounded retry and stop after terminal retry.
- Sweep failure-path pending-state invariants are covered by dedicated tests.
- Build + targeted + full regression suites pass.

## Rollback
- Revert Plan 21 changes in:
  - `extension/src/background.ts`
  - `extension/src/background/persist-queue.ts`
  - `extension/src/background/sweep-coordinator.ts`
  - `tests/helpers/background-harness.mjs`
  - `tests/settings-runtime.test.mjs`
  - `tests/background-event-wiring.test.mjs`
  - `tests/sweep-coordinator.test.mjs`
  - `docs/plans/plan-21-reliability-hardening-opportunities.md`
  - `ROADMAP.md`
- Re-run `npm run build` and `npm run test`.

## Decisions
- Settings transition ordering uses a monotonic in-process epoch guard rather than storage timestamps or schema changes.
- Persistence retry policy is bounded and local-only (`2` retries, exponential backoff from `50ms`) to improve durability without runaway loops.
- Sweep coordinator preserves bounded catch-up semantics while explicitly preventing stale pending-minute leakage after failed runs.

## Retrospective
- What changed: reliability-sensitive runtime edges (settings race, persistence failure recovery, sweep failure state) now have deterministic behavior and direct regression coverage.
- Risks left: Safari-specific lifecycle edge timing still benefits from manual browser validation in addition to automated harness tests.
