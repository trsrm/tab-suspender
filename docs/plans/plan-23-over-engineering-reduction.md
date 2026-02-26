# Plan 23 - Over-Engineering Reduction

## Status
Draft

## Goal
Reduce unnecessary abstraction and internal complexity where implementation is heavier than current product needs.

## Scope
- Target internal patterns with high abstraction overhead.
- Preserve current user-visible behavior and safeguards.

## Non-goals
- No broad rewrites.
- No removal of needed compatibility behavior without evidence.

## Lens Definition
Over-engineering here means complexity that is not justified by current requirements or demonstrated risk.

## Scoring Model
- `Impact` (1-5)
- `Effort` (1-5)
- `Confidence` (1-5)
- `Priority Score = (Impact * Confidence) - Effort`

## Recommendations
### O23-1
- Finding: global mutable runtime state in `background.ts` spans many concerns and requires many guard variables.
- Evidence: numerous module-level mutable bindings (`focusedWindowId`, `nextSweepDueMinute`, multiple queues/flags).
- Risk if unchanged: high incidental complexity and harder onboarding/debugging.
- Proposed change: collapse state into one explicit `RuntimeState` object passed through focused handlers.
- Estimated impact: improved reasoning and lower accidental mutation risk.
- Complexity: medium.
- Dependencies: cross-check with KISS plan K17-1.
- Rollback: restore module-level individual globals.
- Score: Impact 4, Effort 3, Confidence 4, Priority Score 13.

### O23-2
- Finding: compatibility wrappers are implemented per store with full custom promise/callback bridging logic.
- Evidence: repeated detailed wrapper logic across three modules.
- Risk if unchanged: abstraction duplication without proportional benefit.
- Proposed change: replace per-store wrappers with a single thin adapter and keep store modules domain-focused.
- Estimated impact: smaller code surface and fewer failure modes.
- Complexity: medium.
- Dependencies: DRY plan D19-1.
- Rollback: restore existing wrappers.
- Score: Impact 4, Effort 3, Confidence 4, Priority Score 13.

### O23-3
- Finding: test hook surface in `__testing` includes utilities beyond core invariants.
- Evidence: background module exports many test-only helpers.
- Risk if unchanged: production module API accretes testing concerns.
- Proposed change: limit `__testing` to invariant-critical helpers and move scenario-specific helpers into harness-level composition.
- Estimated impact: cleaner production module contract.
- Complexity: low-to-medium.
- Dependencies: YAGNI plan Y18-3.
- Rollback: restore current `__testing` map.
- Score: Impact 3, Effort 2, Confidence 4, Priority Score 10.

## Implementation Steps
1. Define minimal abstraction set required for current v1 scope.
2. Remove or collapse excess abstractions incrementally.
3. Keep regression behavior fixed via targeted and full suites.

## Files Expected to Change
- `extension/src/background.ts`
- `extension/src/settings-store.ts`
- `extension/src/activity-store.ts`
- `extension/src/recovery-store.ts`
- `tests/helpers/background-harness.mjs`
- `tests/*`
- `docs/architecture.md`
- `docs/plans/plan-23-over-engineering-reduction.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run typecheck`
- `npm run test`

## Exit Criteria
- Internal complexity is reduced with no behavior drift.
- Abstraction count is lower and easier to audit.

## Rollback
- Revert Plan 23 files and rerun tests.

## Risks Left
- Some abstractions are still necessary for Safari API compatibility and MV3 lifecycle semantics.
