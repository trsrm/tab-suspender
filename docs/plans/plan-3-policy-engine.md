# Plan 3 - Policy Engine + Unit Tests

## Status
Implemented

## Goal
Add pure suspension policy decisions with a complete reason matrix.

## Scope
- Implement deterministic, side-effect-free policy evaluator logic.
- Cover all `SuspendReason` outputs with explicit tests.
- Keep suspend/restore navigation behavior out of scope until Plan 4/5.

## Implementation Steps
1. Added policy input interfaces in shared types for deterministic evaluator inputs.
2. Added `extension/src/policy.ts` with explicit reason precedence and timeout evaluation.
3. Added table-driven tests covering all reasons, precedence collisions, boundary rules, toggles, and purity.
4. Ran typecheck and full test suite verification.

## Files Added/Changed
- `extension/src/policy.ts`
- `extension/src/types.ts`
- `tests/policy-engine.test.mjs`
- `docs/plans/plan-3-policy-engine.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed.
- Command: `node --test tests/policy-engine.test.mjs`
  - Result: passed (17 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (24 tests, 0 failures).

## Exit Criteria
- Policy tests pass with explicit reason outputs for every `SuspendReason`.
- Reason precedence is deterministic and explicitly asserted.
- Evaluator remains pure and side-effect free.
- No suspend/restore navigation behavior was introduced.

## Rollback
- Revert Plan 3 changes in:
  - `extension/src/policy.ts`
  - `extension/src/types.ts`
  - `tests/policy-engine.test.mjs`
  - `docs/plans/plan-3-policy-engine.md`
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Policy precedence is fixed to: `active` -> `pinned` -> `audible` -> `internalUrl` -> `urlTooLong` -> `excludedHost` -> `timeoutNotReached` -> `eligible`.
- `excludedHost` and `urlTooLong` are represented as pure evaluator flags in Plan 3; their producers are implemented in later plans.
- Idle timeout uses `max(lastActiveAtMinute, lastUpdatedAtMinute)` as the activity reference minute.
- Missing activity defaults to conservative `timeoutNotReached`.

## Retrospective
- What changed: policy evaluation now has a deterministic, fully tested decision matrix with no runtime side effects.
- Risks left: evaluator is not yet wired into suspend navigation, URL payload constraints, or exclusion matching (Plans 4, 5, and 7).
