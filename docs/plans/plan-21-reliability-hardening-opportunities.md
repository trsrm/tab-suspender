# Plan 21 - Reliability Hardening Opportunities

## Status
Draft

## Goal
Strengthen failure handling and state consistency across background lifecycle events without changing intended suspend behavior.

## Scope
- Harden race-prone or lifecycle-sensitive paths.
- Improve determinism in failure and restart scenarios.

## Non-goals
- No new product features.
- No expansion of permissions.

## Lens Definition
Reliability here means preserving correct behavior across runtime restarts, API failures, and event timing races.

## Scoring Model
- `Impact` (1-5)
- `Effort` (1-5)
- `Confidence` (1-5)
- `Priority Score = (Impact * Confidence) - Effort`

## Recommendations
### R21-1
- Finding: rapid storage change events can race with in-flight hydration and cadence updates.
- Evidence: settings hydration and `storage.onChanged` both mutate active runtime settings in `background.ts`.
- Risk if unchanged: rare inconsistent sweep due-time updates when startup and storage writes overlap.
- Proposed change: add explicit settings version stamp/monotonic apply guard to serialize effective settings transitions.
- Estimated impact: medium reliability gain in restart/update windows.
- Complexity: medium.
- Dependencies: settings-runtime tests covering startup + onChanged interleaving.
- Rollback: remove version guard and restore direct apply.
- Score: Impact 4, Effort 3, Confidence 4, Priority Score 13.

### R21-2
- Finding: persistence queues log errors but do not provide bounded retry/backoff strategy.
- Evidence: `schedulePersistActivity` and `schedulePersistRecovery` catch and log, then rely on dirty flag scheduling.
- Risk if unchanged: repeated storage failure can silently drop persistence durability expectations.
- Proposed change: add bounded retry with explicit terminal log state and test coverage for repeated storage failures.
- Estimated impact: improved recovery from transient storage errors.
- Complexity: medium.
- Dependencies: extend storage error tests in harness.
- Rollback: restore current single-attempt queue behavior.
- Score: Impact 4, Effort 3, Confidence 3, Priority Score 9.

### R21-3
- Finding: sweep serialization uses pending minute handoff; failure-path invariants are not explicitly asserted.
- Evidence: `sweepInFlight` / `pendingSweepMinute` coordination in `background.ts`.
- Risk if unchanged: subtle race regressions during future scheduler changes.
- Proposed change: add explicit state-transition assertions and dedicated race tests.
- Estimated impact: high confidence in future sweep refactors.
- Complexity: low-to-medium.
- Dependencies: background harness enhancements.
- Rollback: remove additional assertions/tests.
- Score: Impact 3, Effort 2, Confidence 4, Priority Score 10.

## Implementation Steps
1. Add deterministic transition guards for settings and sweep lifecycle.
2. Add bounded persistence retry semantics.
3. Expand lifecycle and failure-path tests.

## Files Expected to Change
- `extension/src/background.ts`
- `tests/background-event-wiring.test.mjs`
- `tests/settings-runtime.test.mjs`
- `tests/helpers/background-harness.mjs`
- `docs/architecture.md`
- `docs/plans/plan-21-reliability-hardening-opportunities.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `node --test tests/background-event-wiring.test.mjs tests/settings-runtime.test.mjs`
- `npm run test`

## Exit Criteria
- Failure-path behavior for persistence and lifecycle races is deterministic and tested.
- No suspend eligibility regressions.

## Rollback
- Revert Plan 21 files and rerun full suite.

## Risks Left
- Some Safari lifecycle edge cases still require manual real-browser validation.
