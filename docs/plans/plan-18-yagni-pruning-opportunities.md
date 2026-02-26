# Plan 18 - YAGNI Pruning Opportunities

## Status
Draft

## Goal
Remove or defer features and extension points that are not currently required by product goals, reducing maintenance burden.

## Scope
- Identify interfaces and pathways that exceed current v1 requirements.
- Keep user-visible behavior stable unless removing dead/unreachable behavior.

## Non-goals
- No new features.
- No changes to policy defaults.
- No deletion of test-only utilities that are actively required.

## Lens Definition
YAGNI here means removing speculative flexibility that is not delivering current value and increases maintenance cost.

## Scoring Model
- `Impact` (1-5)
- `Effort` (1-5)
- `Confidence` (1-5)
- `Priority Score = (Impact * Confidence) - Effort`

## Recommendations
### Y18-1
- Finding: `runtime.onMessage` returns a legacy skeleton ping payload (`{ ok: true, phase: "skeleton" }`) that is no longer part of core behavior.
- Evidence: message handler in `extension/src/background.ts` only serves PING and logs all other messages.
- Risk if unchanged: stale contract can be mistaken as supported API surface.
- Proposed change: either remove runtime messaging surface entirely or update contract to current runtime version semantics and document it.
- Estimated impact: reduced surface area and clearer API intent.
- Complexity: low.
- Dependencies: update tests asserting PING response behavior.
- Rollback: restore PING listener and prior test expectations.
- Score: Impact 3, Effort 1, Confidence 5, Priority Score 14.

### Y18-2
- Finding: compatibility wrappers in each store support both callback and promise execution paths even though tests currently exercise promise-first behavior.
- Evidence: duplicated wrapper implementations in `settings-store.ts`, `activity-store.ts`, `recovery-store.ts`.
- Risk if unchanged: extra code paths raise maintenance and test burden.
- Proposed change: define a single shared storage adapter and keep only compatibility behavior with demonstrated runtime need.
- Estimated impact: smaller future maintenance footprint.
- Complexity: medium.
- Dependencies: coordinate with DRY plan D19-1.
- Rollback: restore per-store wrappers.
- Score: Impact 4, Effort 3, Confidence 3, Priority Score 9.

### Y18-3
- Finding: `background.ts` exports broad `__testing` hooks that may exceed minimum test interface needs.
- Evidence: multiple helper methods exposed from production module under `__testing` export.
- Risk if unchanged: accidental production coupling to test-only affordances.
- Proposed change: reduce exported test hooks to minimal required surface or move test harness entrypoints behind dev-only module boundary.
- Estimated impact: cleaner public runtime module boundary.
- Complexity: medium.
- Dependencies: test harness updates (`tests/helpers/background-harness.mjs`).
- Rollback: restore existing `__testing` API.
- Score: Impact 3, Effort 3, Confidence 3, Priority Score 6.

## Implementation Steps
1. Inventory currently consumed test hooks and runtime messaging usage.
2. Remove or narrow unused speculative interfaces.
3. Update tests/docs to reflect reduced surface.
4. Validate full regression suite.

## Files Expected to Change
- `extension/src/background.ts`
- `extension/src/settings-store.ts`
- `extension/src/activity-store.ts`
- `extension/src/recovery-store.ts`
- `tests/helpers/background-harness.mjs`
- `tests/background-event-wiring.test.mjs`
- `docs/architecture.md`
- `docs/plans/plan-18-yagni-pruning-opportunities.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `node --test tests/background-event-wiring.test.mjs tests/settings-runtime.test.mjs`
- `npm run test`

## Exit Criteria
- Unused or stale extension points are removed or explicitly justified.
- Test surface matches intentional runtime API boundaries.

## Rollback
- Revert Plan 18 files and re-run `npm run test`.

## Risks Left
- Some compatibility paths may still be needed for Safari-specific edge behavior and should be retained only with explicit rationale.
