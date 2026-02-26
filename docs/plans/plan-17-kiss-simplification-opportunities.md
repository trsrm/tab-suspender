# Plan 17 - KISS Simplification Opportunities

## Status
Draft

## Goal
Simplify background runtime control flow and data ownership so suspend behavior remains deterministic with fewer moving parts.

## Scope
- Reduce cognitive complexity in `extension/src/background.ts` without changing policy behavior.
- Improve locality of state transitions and sweep scheduling.
- Keep existing manifest permissions and storage schema intact.

## Non-goals
- No UX redesign.
- No policy precedence changes.
- No telemetry or remote diagnostics.

## Lens Definition
KISS here means reducing moving parts and branching depth where simpler structure can preserve behavior.

## Scoring Model
- `Impact` (1-5)
- `Effort` (1-5)
- `Confidence` (1-5)
- `Priority Score = (Impact * Confidence) - Effort`

## Recommendations
### K17-1
- Finding: `background.ts` currently mixes runtime wiring, persistence queues, sweep cadence gating, and suspend execution in one module-level state machine.
- Evidence: `extension/src/background.ts` owns listener registration, hydration gates (`settingsReady`, `activityReady`, `runtimeReady`), persistence queues, sweep scheduling, and suspend flow in a single file.
- Risk if unchanged: future behavior changes become slower and regression-prone due to high coupling.
- Proposed change: split into focused internal modules (`runtime-bootstrap`, `sweep-scheduler`, `activity-runtime`, `suspend-runner`) while keeping exported behavior stable.
- Estimated impact: high readability improvement and lower change risk in future plans.
- Complexity: medium.
- Dependencies: existing background harness tests remain as regression guard.
- Rollback: restore previous single-file `background.ts` composition.
- Score: Impact 5, Effort 3, Confidence 4, Priority Score 17.

### K17-2
- Finding: tab activity and recovery persistence queues follow similar lifecycle patterns with duplicated state flags.
- Evidence: paired queue state (`*PersistQueue`, `*PersistScheduled`, `*PersistDirty`) appears twice in `background.ts`.
- Risk if unchanged: queue behavior divergence over time and harder reasoning during reliability incidents.
- Proposed change: use a small generic queued-persist helper (`createPersistQueue`) consumed by both activity and recovery paths.
- Estimated impact: simpler control flow with fewer queue flags.
- Complexity: medium.
- Dependencies: coordinate with DRY plan item D19-1 for shared helper ownership.
- Rollback: inline queue management back into each persistence path.
- Score: Impact 4, Effort 3, Confidence 4, Priority Score 13.

### K17-3
- Finding: sweep cadence state (`nextSweepDueMinute`, `pendingSweepMinute`, `sweepInFlight`) is valid but spread across alarm, request, and run paths.
- Evidence: cadence logic and in-flight coordination are distributed across multiple functions in `background.ts`.
- Risk if unchanged: subtle regressions when introducing new sweep triggers.
- Proposed change: encapsulate sweep lifecycle in a single coordinator with explicit transitions (`idle`, `scheduled`, `running`).
- Estimated impact: easier correctness review for future CPU/perf changes.
- Complexity: medium.
- Dependencies: preserve Plan 15 semantics and associated tests.
- Rollback: restore current free-function orchestration.
- Score: Impact 4, Effort 3, Confidence 3, Priority Score 9.

## Implementation Steps
1. Introduce internal helper modules for background runtime responsibilities.
2. Rewire `background.ts` as composition root only.
3. Keep existing listener behavior and test surface unchanged.
4. Validate with full background and regression suites.

## Files Expected to Change
- `extension/src/background.ts`
- `extension/src/*` (new focused runtime helpers)
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `docs/architecture.md`
- `docs/plans/plan-17-kiss-simplification-opportunities.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `node --test tests/background-event-wiring.test.mjs tests/suspend-action.test.mjs tests/settings-runtime.test.mjs`
- `npm run test`

## Exit Criteria
- Background behavior remains unchanged with reduced module complexity.
- No regression in sweep cadence, action-click suspend, or persistence behavior.
- New module boundaries are documented.

## Rollback
- Revert only files touched by Plan 17 and re-run full test suite.

## Risks Left
- Internal module split can improve structure but still leaves MV3 lifecycle complexity requiring careful test coverage.
