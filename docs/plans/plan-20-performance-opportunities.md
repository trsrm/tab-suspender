# Plan 20 - Performance Opportunities

## Status
Draft

## Goal
Reduce unnecessary CPU and allocation overhead in steady-state background and UI pathways while preserving existing behavior.

## Scope
- Focus on local CPU/allocation hotspots and query efficiency.
- Preserve Plan 15 adaptive sweep semantics.

## Non-goals
- No policy model redesign.
- No new user-facing settings.

## Lens Definition
Performance here means lowering recurring compute and memory overhead on common runtime paths.

## Scoring Model
- `Impact` (1-5)
- `Effort` (1-5)
- `Confidence` (1-5)
- `Priority Score = (Impact * Confidence) - Effort`

## Recommendations
### P20-1
- Finding: exclusion matching reparses URLs for each candidate tab during every sweep.
- Evidence: `isExcludedUrlByHost` performs `new URL(url)` inside sweep evaluation path.
- Risk if unchanged: unnecessary parsing overhead scales with tab count.
- Proposed change: parse URL once in sweep pipeline and pass hostname/protocol into policy flags.
- Estimated impact: medium CPU reduction under high tab counts.
- Complexity: medium.
- Dependencies: policy input shape update and tests.
- Rollback: restore current URL parsing inside matcher helper.
- Score: Impact 4, Effort 3, Confidence 4, Priority Score 13.

### P20-2
- Finding: activity snapshot sorting runs on each persistence write regardless of changed tab count.
- Evidence: `snapshotActivityState()` maps and sorts all records before writes.
- Risk if unchanged: avoidable allocation/sort overhead with large activity maps.
- Proposed change: evaluate incremental persistence strategy or deferred sorting only at write boundaries that need deterministic order.
- Estimated impact: moderate background CPU/GC reduction.
- Complexity: medium.
- Dependencies: keep deterministic persistence assertions in tests.
- Rollback: restore current full-snapshot sort strategy.
- Score: Impact 3, Effort 3, Confidence 3, Priority Score 6.

### P20-3
- Finding: options recovery list fully rerenders all rows in one pass.
- Evidence: `renderRecoveryList` rebuilds and replaces child nodes for entire list.
- Risk if unchanged: minor UI jank when recovery list reaches max size.
- Proposed change: apply keyed row updates or fragment diffing for incremental updates.
- Estimated impact: low-to-medium UI responsiveness gain.
- Complexity: medium.
- Dependencies: settings UI tests.
- Rollback: restore full replaceChildren rendering.
- Score: Impact 2, Effort 3, Confidence 3, Priority Score 3.

## Implementation Steps
1. Profile/measure current hotspots in synthetic local scenarios.
2. Implement one optimization at a time with regression tests.
3. Validate no policy, recovery, or settings behavior drift.

## Files Expected to Change
- `extension/src/background.ts`
- `extension/src/matcher.ts`
- `extension/src/policy.ts`
- `extension/src/options.ts`
- `extension/src/types.ts`
- `tests/suspend-action.test.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/settings-ui.test.mjs`
- `docs/architecture.md`
- `docs/plans/plan-20-performance-opportunities.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `npm run test`
- Add targeted micro-benchmark assertions where deterministic.

## Exit Criteria
- At least one high-priority hotspot is optimized with measurable local improvement.
- Existing behavior and safety guardrails remain unchanged.

## Rollback
- Revert Plan 20 files and rerun tests.

## Risks Left
- Safari runtime characteristics may differ from Node tests; manual profiling remains necessary.
