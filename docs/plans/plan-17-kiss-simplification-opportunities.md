# Plan 17 - KISS Refactor of Background Runtime (K17-1 + K17-2 + K17-3)

## Status
Implemented

## Goal
Refactor background runtime internals into focused modules while preserving runtime behavior and storage/message contracts.

## Scope
- Split monolithic `extension/src/background.ts` internals into focused background modules.
- Replace duplicated activity/recovery queued persistence logic with a shared helper.
- Encapsulate sweep cadence + in-flight/pending coalescing in a dedicated coordinator.
- Preserve existing suspend behavior, policy decisions, action-click semantics, and storage schema.

## Implementation Steps
1. Added internal background modules:
   - `extension/src/background/persist-queue.ts`
   - `extension/src/background/sweep-coordinator.ts`
   - `extension/src/background/runtime-bootstrap.ts`
   - `extension/src/background/activity-runtime.ts`
   - `extension/src/background/suspend-runner.ts`
2. Rewired `extension/src/background.ts` to act as composition root for listener registration and module wiring.
3. Replaced duplicate activity/recovery dirty-queue persistence state with `createPersistQueue(...)` instances.
4. Moved sweep cadence + overlap/catch-up handling behind `createSweepCoordinator(...)`.
5. Preserved existing `__testing` hooks used by background harness tests.
6. Updated architecture + roadmap docs for Plan 17 completion and decisions.

## Files Added/Changed
- `extension/src/background.ts`
- `extension/src/background/persist-queue.ts`
- `extension/src/background/sweep-coordinator.ts`
- `extension/src/background/runtime-bootstrap.ts`
- `extension/src/background/activity-runtime.ts`
- `extension/src/background/suspend-runner.ts`
- `docs/architecture.md`
- `docs/plans/plan-17-kiss-simplification-opportunities.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed (`tsc -p tsconfig.json && node scripts/copy-extension-assets.mjs`).
- Command: `node --test tests/background-event-wiring.test.mjs tests/suspend-action.test.mjs tests/settings-runtime.test.mjs tests/reload-recovery.test.mjs`
  - Result: passed (35 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (81 tests, 0 failures).

## Exit Criteria
- `background.ts` is reduced to listener wiring + module composition.
- Persist queue duplication removed from runtime code paths.
- Sweep lifecycle state is owned by a dedicated coordinator.
- Existing runtime behavior and contracts remain unchanged, validated by passing regression suites.

## Rollback
- Revert Plan 17 changes in:
  - `extension/src/background.ts`
  - `extension/src/background/persist-queue.ts`
  - `extension/src/background/sweep-coordinator.ts`
  - `extension/src/background/runtime-bootstrap.ts`
  - `extension/src/background/activity-runtime.ts`
  - `extension/src/background/suspend-runner.ts`
  - `docs/architecture.md`
  - `docs/plans/plan-17-kiss-simplification-opportunities.md`
  - `ROADMAP.md`
- Rebuild and rerun regression checks:
  - `npm run build`
  - `npm run test`

## Decisions
- Keep public/runtime behavior unchanged and scope all Plan 17 changes to internal structure.
- Preserve existing `__testing` surface to avoid unnecessary test harness churn.
- Keep cadence computation and alarm wiring semantics unchanged while isolating sweep state transitions.

## Retrospective
- What changed: background runtime responsibilities are now split into focused modules with explicit ownership boundaries.
- Risks left: MV3 lifecycle complexity still requires broad regression coverage when future runtime behavior changes are introduced.
