# Plan 22 - Simplicity UX and Maintenance

## Status
Draft

## Goal
Reduce UX and maintenance complexity in options/suspended views while preserving all existing guardrails.

## Scope
- Simplify options-page status and recovery interactions.
- Clarify user messaging without adding new workflows.

## Non-goals
- No visual redesign requiring asset overhaul.
- No changes to restore URL safety policy.

## Lens Definition
Simplicity here means lowering user and maintainer cognitive load with clearer, smaller UI-state logic.

## Scoring Model
- `Impact` (1-5)
- `Effort` (1-5)
- `Confidence` (1-5)
- `Priority Score = (Impact * Confidence) - Effort`

## Recommendations
### S22-1
- Finding: options status text multiplexes load/save/reopen/failure states through one free-form message region.
- Evidence: `setStatus(...)` in `options.ts` is reused for unrelated workflows.
- Risk if unchanged: ambiguous status messages and brittle UI assertions.
- Proposed change: split status channels into scoped regions (settings status vs recovery action status).
- Estimated impact: clearer UX feedback and cleaner UI tests.
- Complexity: low-to-medium.
- Dependencies: update `tests/settings-ui.test.mjs` expectations.
- Rollback: restore single status channel.
- Score: Impact 3, Effort 2, Confidence 4, Priority Score 10.

### S22-2
- Finding: recovery row rendering and action wiring are implemented inline, mixing DOM creation and behavior logic.
- Evidence: `renderRecoveryList` creates elements and click handlers in one large function.
- Risk if unchanged: harder to test and evolve row-level behavior.
- Proposed change: extract pure row view-model + row-render helper for composable tests.
- Estimated impact: maintainability improvement with stable behavior.
- Complexity: medium.
- Dependencies: settings UI tests and accessibility checks.
- Rollback: restore inline row rendering logic.
- Score: Impact 3, Effort 3, Confidence 4, Priority Score 9.

### S22-3
- Finding: suspended-page copy/restore statuses are independent but represented through ad hoc text constants.
- Evidence: `suspended.ts` status constants are local and not grouped by interaction intent.
- Risk if unchanged: copy drift and inconsistent tone across future changes.
- Proposed change: centralize view text in grouped message maps and keep explicit state transition table.
- Estimated impact: small but meaningful UX consistency gain.
- Complexity: low.
- Dependencies: restore-flow tests.
- Rollback: revert grouped message abstraction.
- Score: Impact 2, Effort 1, Confidence 4, Priority Score 7.

## Implementation Steps
1. Split options/suspended status logic by interaction domain.
2. Extract row/message helpers for easier testing.
3. Re-run UI-related test suites and accessibility checks.

## Files Expected to Change
- `extension/src/options.ts`
- `extension/src/suspended.ts`
- `extension/options.html`
- `extension/suspended.html`
- `tests/settings-ui.test.mjs`
- `tests/restore-flow.test.mjs`
- `docs/plans/plan-22-simplicity-ux-and-maintenance.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `node --test tests/settings-ui.test.mjs tests/restore-flow.test.mjs`
- `npm run test`

## Exit Criteria
- UI state messaging is clearer and less coupled.
- Existing restore/reopen behavior remains unchanged.

## Rollback
- Revert Plan 22 files and rerun full tests.

## Risks Left
- Browser-native clipboard behavior still requires manual Safari verification.
