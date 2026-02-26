# Plan 27 - Recovery Center UX Enhancements

## Status
Draft

## Goal
Improve the Options recovery experience so users can quickly find and safely reopen suspended tabs after disruptions.

## Scope
- Extend `Recently Suspended Tabs` with search, sort, and filter controls.
- Add safe bulk reopen workflows (visible-set reopen with validation and cap).
- Preserve current URL safety guardrails for every reopen action.

## Non-goals
- No automatic reopen on startup.
- No remote backup/sync for recovery entries.
- No change to core recovery persistence model unless required for UX metadata.

## User Value
- Faster recovery in high-volume incidents.
- Better control when many suspended tabs were captured over time.

## Proposed UX/API/Data Model Changes
- UX:
  - Add query filter (title/url), sort controls (newest/oldest/domain), and invalid-entry visibility flags.
  - Add `Reopen Visible` action with confirmation and bounded operation count.
- API/runtime:
  - Reopen flow remains `tabs.create`-based and URL-validator gated.
- Data model/storage (anticipated):
  - Optional metadata extensions for recovery entries (domain cache, reopen attempt count, optional tag).
- Types/interfaces (anticipated):
  - Extend recovery row view model types and bulk-action result contract.
- Manifest (anticipated):
  - No new permissions required.

## Risks and Failure Modes
- Bulk reopen can flood tab creation if limits are not enforced.
- Complex filtering/sorting may increase options-page rendering complexity.
- UX confusion if invalid entries are hidden by default.

## Implementation Steps
1. Define recovery list view model and deterministic sort/filter rules.
2. Add options UI controls and accessible list update behavior.
3. Implement bounded bulk reopen with per-URL validation and partial-failure reporting.
4. Add tests for filtering, sorting, bulk reopen limit enforcement, and invalid entry handling.

## Files Expected to Change
- `extension/src/options.ts`
- `extension/options.html`
- `extension/src/recovery-store.ts` (if metadata extension required)
- `extension/src/types.ts`
- `tests/settings-ui.test.mjs`
- `tests/recovery-store.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/plan-27-recovery-center-ux-enhancements.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `npm run typecheck`
- `node --test tests/settings-ui.test.mjs tests/recovery-store.test.mjs`
- `npm run test`
- Manual Safari UX check for keyboard accessibility and bulk action confirmation.

## Exit Criteria
- Users can search/filter/sort recovery entries deterministically.
- Bulk reopen is bounded, validator-gated, and reports partial failures.
- Existing single-entry reopen remains intact.

## Rollback
- Revert Plan 27 files and rerun full tests.

## Dependencies / Cross-Plan References
- Builds on Plan 14 recovery ledger baseline.
- Could share status-channel simplifications with Plan 22 when implemented.

## Scoring
- Impact: 4
- Effort: 3
- Confidence: 4
- Priority Score: 13
