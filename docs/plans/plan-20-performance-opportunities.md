# Plan 20 - Performance Opportunities

## Status
Implemented

## Goal
Reduce recurring CPU/allocation overhead in background suspend evaluation, activity persistence, and options recovery rendering while preserving existing behavior contracts.

## Scope
- P20-1: Single-pass URL analysis in suspend evaluation paths.
- P20-2: Persistence-oriented activity snapshot path with deterministic storage ordering preserved.
- P20-3: Keyed recovery-list reconciliation in options UI.

## Non-goals
- No policy model redesign.
- No user-facing settings changes.
- No storage schema/version changes.

## Implementation Steps
1. Added metadata-capable URL validation helper and reused it from suspend-runner for one-pass URL analysis.
2. Updated policy input flags to include `internalUrl` and made evaluator prefer the precomputed flag while keeping URL-based fallback behavior.
3. Refactored suspend-runner to derive `internalUrl`, `urlTooLong`, `excludedHost`, and `restorableUrl` from one URL-analysis pass; reused analyzed URL for payload creation.
4. Split activity snapshot responsibilities in `activity-runtime`:
   - kept sorted/cloned diagnostic snapshots for tests/debug.
   - switched persistence writes to an unsorted collection path and relied on `activity-store` sanitize/sort for deterministic storage ordering.
   - added sorted snapshot cache invalidation on activity mutations.
5. Replaced full recovery list rebuild path in options with keyed reconciliation:
   - stable key built from `(url, title, suspendedAtMinute, duplicateOrdinal)`.
   - unchanged rows are reused; changed rows are replaced.
6. Added/updated tests for policy flag behavior, URL metadata validation, deterministic persisted activity ordering, and recovery row reuse behavior.

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/url-safety.ts`
- `extension/src/policy.ts`
- `extension/src/background/suspend-runner.ts`
- `extension/src/background/activity-runtime.ts`
- `extension/src/options.ts`
- `tests/policy-engine.test.mjs`
- `tests/restore-flow.test.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/settings-ui.test.mjs`
- `docs/plans/plan-20-performance-opportunities.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed (`tsc -p tsconfig.json && node scripts/copy-extension-assets.mjs`).
- Command: `npm run test`
  - Result: passed (87 tests, 0 failures).
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).

## Exit Criteria
- Suspend evaluation now uses a single URL parse per candidate evaluation path.
- Policy reason precedence and action-click bypass semantics are unchanged.
- Persisted `activityState` remains deterministic and schema-compatible.
- Recovery list rerender reuses unchanged rows.
- Build/test/typecheck all pass.

## Rollback
- Revert Plan 20 changes in:
  - `extension/src/types.ts`
  - `extension/src/url-safety.ts`
  - `extension/src/policy.ts`
  - `extension/src/background/suspend-runner.ts`
  - `extension/src/background/activity-runtime.ts`
  - `extension/src/options.ts`
  - `tests/policy-engine.test.mjs`
  - `tests/restore-flow.test.mjs`
  - `tests/background-event-wiring.test.mjs`
  - `tests/settings-ui.test.mjs`
  - `docs/plans/plan-20-performance-opportunities.md`
  - `ROADMAP.md`
- Re-run `npm run build` and `npm run test`.

## Decisions
- Precompute URL-derived policy flags in suspend-runner and pass them into policy evaluator to avoid repeated URL parsing.
- Keep `validateRestorableUrl()` API unchanged and add `validateRestorableUrlWithMetadata()` for internal reuse.
- Preserve deterministic persisted activity ordering by relying on existing `activity-store` sanitization/sort contract.
- Use keyed row reconciliation in options recovery UI without changing user-visible copy or controls.

## Risks Left
- Runtime performance improvements are validated structurally and by behavior invariants; Safari-specific CPU profiling is still recommended for empirical measurement under large real-world tab sets.

## Retrospective
- What changed: repeated URL parsing and full-list rerender churn were removed from hot paths, and persistence writes avoid unnecessary sort/clone work.
- Risks left: options reconciliation assumes key stability from sanitized recovery entries and should be rechecked if recovery entry shape changes in future plans.
