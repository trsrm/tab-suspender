# Plan 24 - Anti-Patterns and Code Health

## Status
Draft

## Goal
Address maintainability and correctness anti-patterns not fully covered by other lenses.

## Scope
- Focus on code-health improvements: explicit contracts, invariants, and error handling clarity.
- Avoid overlapping implementation with other lens plans unless cross-referenced.

## Non-goals
- No feature work.
- No policy semantics changes.

## Lens Definition
This lens captures cross-cutting anti-patterns in typing, error semantics, and maintainability hygiene.

## Scoring Model
- `Impact` (1-5)
- `Effort` (1-5)
- `Confidence` (1-5)
- `Priority Score = (Impact * Confidence) - Effort`

## Recommendations
### A24-1
- Finding: background message handling uses loosely typed payload inspection.
- Evidence: runtime listener casts `message` to `{ type?: string } | null | undefined` and branches on ad hoc string checks.
- Risk if unchanged: fragile message-contract evolution and reduced static guarantees.
- Proposed change: add discriminated union message types in `types.ts` and parse guards in background listener.
- Estimated impact: stronger type safety and clearer runtime contracts.
- Complexity: low.
- Dependencies: update message-related tests.
- Rollback: revert to current loose message handling.
- Score: Impact 3, Effort 1, Confidence 5, Priority Score 14.

### A24-2
- Finding: fallback/error statuses are represented as free-form strings across options and suspended views.
- Evidence: many hardcoded literals in `options.ts` and `suspended.ts`.
- Risk if unchanged: inconsistency and brittle tests on exact text coupling.
- Proposed change: centralize status enums/message maps with explicit state-to-text mapping.
- Estimated impact: improved consistency and lower copy drift.
- Complexity: medium.
- Dependencies: coordinate with simplicity plan S22-3.
- Rollback: restore inline string literals.
- Score: Impact 3, Effort 2, Confidence 4, Priority Score 10.

### A24-3
- Finding: store decode/sanitize functions are robust but invariant expectations are partially implicit.
- Evidence: sanitation paths in `settings-store.ts`, `activity-store.ts`, `recovery-store.ts` rely on local assumptions not all expressed as named invariants.
- Risk if unchanged: future contributors may introduce subtle schema handling regressions.
- Proposed change: add explicit invariant comments and focused tests for schema edge cases (invalid types, boundary values, duplicates).
- Estimated impact: better long-term correctness confidence.
- Complexity: low-to-medium.
- Dependencies: store test expansions.
- Rollback: remove invariant annotations/tests added by this plan.
- Score: Impact 3, Effort 2, Confidence 4, Priority Score 10.

## Implementation Steps
1. Introduce typed contracts for runtime messages and UI status mapping.
2. Add explicit invariants for decode/sanitize behavior.
3. Expand test coverage for edge-case schema payloads.

## Files Expected to Change
- `extension/src/background.ts`
- `extension/src/types.ts`
- `extension/src/options.ts`
- `extension/src/suspended.ts`
- `extension/src/settings-store.ts`
- `extension/src/activity-store.ts`
- `extension/src/recovery-store.ts`
- `tests/*`
- `docs/architecture.md`
- `docs/plans/plan-24-anti-patterns-and-code-health.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run typecheck`
- `npm run test`

## Exit Criteria
- Identified anti-patterns are replaced by explicit, typed, and tested contracts.
- No runtime behavior regressions.

## Rollback
- Revert Plan 24 files and rerun tests.

## Risks Left
- Full confidence still depends on periodic manual Safari smoke validation for UI/runtime integration.
