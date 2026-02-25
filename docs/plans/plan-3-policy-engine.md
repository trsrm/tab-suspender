# Plan 3 - Policy Engine + Unit Tests

## Status
Not Implemented

## Goal
Add pure suspension policy decisions with a complete reason matrix.

## Scope
- Implement deterministic policy evaluator.
- Keep logic side-effect free and fully unit tested.

## Planned Steps
1. Add `SuspendDecision` policy evaluator module.
2. Encode default rules (60m target, skip pinned/audible/internal).
3. Add table-driven tests for each reason path.

## Planned Files
- `extension/src/policy.ts`
- `extension/src/types.ts`
- `tests/policy.*`

## Planned Tests
- Full decision matrix coverage.

## Exit Criteria
- Policy tests pass with explicit reason outputs.

## Rollback
- Revert policy module and tests.

## Decisions
- Pending implementation decisions recorded during execution.
