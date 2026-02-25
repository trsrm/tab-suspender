# Plan 9 - Technical Debt Cleanup and Contributor Documentation

## Status
Implemented

## Goal
Add contributor workflow docs, reduce background runtime maintenance debt without behavior changes, and deduplicate repeated background test harness code.

## Scope
- Add `CONTRIBUTING.md` with repo-specific contributor workflow and quality expectations.
- Refactor duplicated callback/Promise compatibility logic in `background.ts` into one helper.
- Add concise comments for non-obvious runtime lifecycle/safety behavior.
- Extract shared background test harness utilities into `tests/helpers/background-harness.mjs`.
- Migrate background-related suites to the shared harness without changing assertion intent.

## Implementation Steps
1. Added `CONTRIBUTING.md` with prerequisites, local setup, plan-scoped workflow, required checks, evidence format, rollback expectations, documentation rules, and PR hygiene.
2. Added a README `Contributing` pointer and updated status text to reflect implemented plan count.
3. Refactored `extension/src/background.ts` callback/Promise bridging into `invokeChromeApiWithCompatibility`, then reused it in `queryTabs` and `updateTab`.
4. Added targeted comments in `background.ts` for settings hydration gating, action-click bypass semantics, sweep timing, and alarm re-registration intent.
5. Added `tests/helpers/background-harness.mjs` to centralize background test setup (`createChromeMock`, `importBackgroundWithMock`, `setNowMinute`, `flushAsyncWork`, and cleanup).
6. Updated `background-event-wiring`, `suspend-action`, and `settings-runtime` suites to consume the shared harness.
7. Ran required validation commands and recorded results.
8. Updated roadmap/plan index status entries for Plan 9 completion.

## Files Added/Changed
- `CONTRIBUTING.md`
- `README.md`
- `extension/src/background.ts`
- `tests/helpers/background-harness.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `tests/settings-runtime.test.mjs`
- `docs/plans/plan-9-technical-debt-contributor-docs.md`
- `docs/plans/README.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run build && node --test tests/background-event-wiring.test.mjs tests/suspend-action.test.mjs tests/settings-runtime.test.mjs`
  - Result: passed (20 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (57 tests, 0 failures).

## Exit Criteria
- `CONTRIBUTING.md` exists and documents the repository’s plan-scoped contribution workflow.
- Background callback/Promise compatibility duplication is reduced to one helper in `background.ts`.
- The three background-related suites use a shared harness module.
- Typecheck, targeted suites, and full suite pass.
- Roadmap and plan records are updated with final status, evidence, and rollback details.

## Rollback
- Revert Plan 9 changes in:
  - `CONTRIBUTING.md`
  - `README.md`
  - `extension/src/background.ts`
  - `tests/helpers/background-harness.mjs`
  - `tests/background-event-wiring.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `tests/settings-runtime.test.mjs`
  - `docs/plans/plan-9-technical-debt-contributor-docs.md`
  - `docs/plans/README.md`
  - `ROADMAP.md`
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Preserve runtime behavior and compatibility signals (`PING` response remains `{ ok: true, phase: "skeleton" }`) while cleaning internals.
- Keep test deduplication focused on shared harness scaffolding only; leave test assertions and coverage intent unchanged.

## Retrospective
- What changed: contributor guidance now exists, background runtime compatibility glue is centralized, and background test suites share one harness utility.
- Risks left: manual Safari smoke validation remains an operator-run activity outside automated Node coverage.
