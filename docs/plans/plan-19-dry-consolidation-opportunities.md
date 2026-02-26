# Plan 19 - DRY Consolidation Opportunities

## Status
Implemented

## Goal
Reduce maintenance fan-out by centralizing duplicated captured-time formatting and suspended-title truncation limits with no behavior-contract changes.

## Scope
- Consolidate UTC captured-time formatting into a shared utility.
- Canonicalize suspended-title max length into a shared constant.

## Non-goals
- No policy evaluation behavior changes.
- No storage schema/version changes.
- No additional storage-compat refactor work (already completed in Plan 18).

## Implementation Steps
1. Added `extension/src/time-format.ts` with `formatCapturedAtMinuteUtc(minute)` to preserve existing UTC formatting and fallback text.
2. Canonicalized `MAX_SUSPENDED_TITLE_LENGTH = 120` in `extension/src/suspended-payload.ts`.
3. Rewired consumer modules:
   - `options.ts` now uses shared captured-time formatter.
   - `suspended.ts` now uses shared captured-time formatter.
   - `suspended-payload.ts` now uses shared captured-time formatter and shared title constant (with re-export preserved).
   - `recovery-store.ts` now uses shared title constant for recovery title truncation.
4. Added targeted formatter parity tests (`tests/time-format.test.mjs`) for valid, invalid/non-finite, and exception fallback cases.

## Files Added/Changed
- `extension/src/time-format.ts`
- `extension/src/options.ts`
- `extension/src/suspended.ts`
- `extension/src/suspended-payload.ts`
- `extension/src/recovery-store.ts`
- `tests/time-format.test.mjs`
- `docs/plans/plan-19-dry-consolidation-opportunities.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed.
- Command: `npm run test`
  - Result: passed (83 tests, 0 failures).

## Exit Criteria
- No duplicated captured-time formatter implementations remain in source modules.
- Suspended-title max length is canonicalized via a shared constant.
- Automated checks pass with no regressions.

## Rollback
- Revert Plan 19-touched files listed above.
- Re-run `npm run typecheck` and `npm run test` to verify baseline restoration.

## Decisions
- Kept string outputs exactly aligned with prior behavior:
  - `Captured at YYYY-MM-DD HH:MM UTC.`
  - `Capture time unavailable.`
  - `Captured at minute <value>.`
- Kept canonical truncation limit at `120` and reused it for suspended/recovery title sanitization.
- Preserved existing `suspended-payload.ts` export contract for `MAX_SUSPENDED_TITLE_LENGTH` and reused it in recovery title sanitization.

## Retrospective
- What changed: shared utility/constant now cover all duplicated timestamp/title-limit logic targeted by remaining Plan 19 DRY scope.
- Risks left: low; future title-limit divergence risk remains possible only if new module-local constants are introduced without reusing shared modules.
