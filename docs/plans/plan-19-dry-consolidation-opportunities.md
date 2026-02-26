# Plan 19 - DRY Consolidation Opportunities

## Status
Draft

## Goal
Eliminate repeated utility logic so storage and formatting behavior are implemented once and reused consistently.

## Scope
- Consolidate repeated store compatibility wrappers.
- Consolidate duplicated timestamp formatting and title-length constants where appropriate.

## Non-goals
- No behavior change in policy evaluation.
- No storage schema version bump.

## Lens Definition
DRY here means centralizing repeated logic with stable contracts to reduce bug-fix fan-out.

## Scoring Model
- `Impact` (1-5)
- `Effort` (1-5)
- `Confidence` (1-5)
- `Priority Score = (Impact * Confidence) - Effort`

## Recommendations
### D19-1
- Status note: superseded by Plan 18 implementation (`storage-compat.ts` shared adapter in use).
- Finding: three storage modules duplicate callback/promise compatibility wrappers.
- Evidence: `getRuntimeLastError`, `getStorageArea`, `getWithCompatibility`, and `setWithCompatibility` are repeated in:
  - `extension/src/settings-store.ts`
  - `extension/src/activity-store.ts`
  - `extension/src/recovery-store.ts`
- Risk if unchanged: fixes must be applied in multiple files and can drift.
- Proposed change: extract shared `storage-compat.ts` with typed `getKey`/`setItems` helpers.
- Estimated impact: strong maintainability gain and reduced defect risk.
- Complexity: medium.
- Dependencies: ensure all store tests continue passing.
- Rollback: inline helper logic back into each store.
- Score: Impact 5, Effort 3, Confidence 5, Priority Score 22.

### D19-2
- Finding: UTC minute display formatting exists in both options and suspended views.
- Evidence: similar `new Date(minute * 60_000).toISOString().slice(0, 16).replace("T", " ")` formatting appears in `options.ts` and `suspended.ts`.
- Risk if unchanged: user-facing copy can diverge with future format updates.
- Proposed change: extract shared formatter utility under `extension/src/time-format.ts`.
- Estimated impact: moderate consistency gain.
- Complexity: low.
- Dependencies: update view tests.
- Rollback: restore local formatter functions.
- Score: Impact 3, Effort 1, Confidence 5, Priority Score 14.

### D19-3
- Finding: title-length constants are repeated across modules with overlapping semantics.
- Evidence: `MAX_SUSPENDED_TITLE_LENGTH` in `background.ts`, `MAX_TITLE_LENGTH` in `suspended.ts`, and `MAX_RECOVERY_TITLE_LENGTH` in `recovery-store.ts`.
- Risk if unchanged: silent divergence in truncation behavior.
- Proposed change: centralize title limits in shared constants module with explicit intent labels.
- Estimated impact: modest consistency and lower drift risk.
- Complexity: low.
- Dependencies: keep tests covering truncation semantics.
- Rollback: move constants back to module-local definitions.
- Score: Impact 3, Effort 1, Confidence 4, Priority Score 11.

## Implementation Steps
1. Create shared utility modules for storage compatibility and formatting/constants.
2. Migrate each consumer module with no behavioral deltas.
3. Expand/adjust tests where needed to lock shared behavior.

## Files Expected to Change
- `extension/src/settings-store.ts`
- `extension/src/activity-store.ts`
- `extension/src/recovery-store.ts`
- `extension/src/options.ts`
- `extension/src/suspended.ts`
- `extension/src/background.ts`
- `extension/src/storage-compat.ts` (new)
- `extension/src/time-format.ts` (new)
- `extension/src/constants.ts` (new)
- `tests/*`
- `docs/architecture.md`
- `docs/plans/plan-19-dry-consolidation-opportunities.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run typecheck`
- `npm run test`
- Targeted assertions for storage adapter compatibility and timestamp/title formatting.

## Exit Criteria
- Shared helper modules replace duplicated logic.
- No runtime behavior regressions.

## Rollback
- Revert Plan 19 files and rerun full tests.

## Risks Left
- Over-consolidation can hide domain intent; helper naming must preserve clarity.
