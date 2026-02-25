# Plan 15 - Safari CPU Reduction via Adaptive Sweep Cadence + Candidate Filtering

## Status
Implemented

## Goal
Reduce Safari CPU usage under high tab counts by cutting unnecessary background sweep work while preserving existing suspension safety behavior.

## Scope
- Keep the existing 1-minute sweep alarm for MV3 reliability.
- Gate expensive suspend sweeps to an adaptive `1..5` minute cadence based on `idleMinutes`.
- Query fewer sweep candidates with safe tab-query filters and fallback behavior.
- Skip extension suspended-page URLs during sweep to avoid self-churn.

## Implementation Steps
1. Added adaptive sweep cadence helpers in `background.ts`:
   - `computeSweepIntervalMinutes(settings)` using `Math.min(5, Math.max(1, Math.floor(idleMinutes / 12)))`.
   - `nextSweepDueMinute` gating so alarm ticks only run sweeps when due.
   - Settings-change cadence alignment so lower intervals can pull the next sweep earlier.
2. Updated suspend sweep query path to request filtered candidates (`active: false` plus optional `pinned: false` and `audible: false` based on settings).
3. Added safe fallback to unfiltered query (`queryTabs({})`) if the filtered query fails for compatibility reasons.
4. Added `suspended.html` URL short-circuit in `suspendTabIfEligible` to avoid re-processing already suspended extension pages.
5. Extended test coverage for cadence gating, settings-driven cadence updates, filtered query shape, filtered-query fallback, and suspended-page skip behavior.
6. Updated architecture and roadmap docs with Plan 15 runtime behavior and decision logging.

## Files Added/Changed
- `extension/src/background.ts`
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `docs/architecture.md`
- `docs/plans/README.md`
- `ROADMAP.md`
- `docs/plans/plan-15-safari-cpu-reduction.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed (`tsc -p tsconfig.json && node scripts/copy-extension-assets.mjs`).
- Command: `node --test tests/background-event-wiring.test.mjs tests/suspend-action.test.mjs tests/settings-runtime.test.mjs`
  - Result: passed (35 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (81 tests, 0 failures).
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).

## Exit Criteria
- Alarm still ticks every minute, but full sweeps run on adaptive due intervals (`1..5` minutes).
- Sweep query path uses candidate filters and falls back safely when filtered query fails.
- Existing suspend safety semantics and manual action-click behavior remain unchanged.
- Regression suites pass with explicit evidence.

## Rollback
- Revert Plan 15 changes in:
  - `extension/src/background.ts`
  - `tests/background-event-wiring.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `docs/architecture.md`
  - `docs/plans/README.md`
  - `ROADMAP.md`
  - `docs/plans/plan-15-safari-cpu-reduction.md`
- Rebuild runtime outputs with `npm run build`.

## Decisions
- Keep 1-minute alarm registration unchanged and reduce CPU via in-handler cadence gating instead of alarm period changes.
- Favor CPU reduction over minute-level precision by allowing up to 5-minute additional suspend delay.
- Prefer filtered candidate query by default with unfiltered fallback for robustness.

## Retrospective
- What changed: background sweep workload is reduced by adaptive cadence gating, filtered candidate queries, and skipping already suspended extension pages.
- Risks left: final confidence still depends on manual Safari profiling because Node tests cannot directly measure Safari CPU impact.
