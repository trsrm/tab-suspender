# Plan 30 - Suspension Reason Transparency

## Status
Draft

## Goal
Provide clear, user-visible diagnostics in Options explaining why current tabs are not yet suspend-eligible using existing policy reasons.

## Scope
- Add diagnostics panel in Options that inspects open tabs and reports policy outcome reasons.
- Reuse existing deterministic policy reason taxonomy.
- Keep diagnostics read-only and local.

## Non-goals
- No background telemetry or analytics.
- No automatic policy changes based on diagnostics.
- No modification to policy precedence.

## User Value
- Reduces confusion when tabs do not suspend as expected.
- Improves self-service troubleshooting without external tooling.

## Proposed UX/API/Data Model Changes
- UX:
  - Add `Why tabs are not suspending` panel in Options with per-tab reason labels.
  - Include lightweight summary counts by reason (`active`, `pinned`, `audible`, `excludedHost`, `timeoutNotReached`, etc.).
- API/runtime:
  - Add internal query endpoint/message for options page to request snapshot policy evaluation results.
- Data model/storage (anticipated):
  - No required persistent schema changes; optional short-lived cache in memory only.
- Types/interfaces (anticipated):
  - Add typed diagnostics response contracts (tab id/title/url summary, reason, eligible flag).
- Manifest (anticipated):
  - No new permissions expected beyond existing `tabs`.

## Risks and Failure Modes
- Diagnostics can leak sensitive URL/title details if rendered without clear local-only framing.
- Real-time snapshots may drift from next sweep minute and confuse expectations.
- Large tab sets may make options diagnostics slow without paging/caps.

## Implementation Steps
1. Define typed diagnostics message contract and reason mapping.
2. Add background snapshot evaluator reusing existing policy evaluator inputs.
3. Add options diagnostics UI with bounded list rendering and summary counts.
4. Add tests for reason mapping correctness and message failure handling.
5. Update docs with diagnostics caveats and local-only behavior.

## Files Expected to Change
- `extension/src/background.ts`
- `extension/src/policy.ts`
- `extension/src/types.ts`
- `extension/src/options.ts`
- `extension/options.html`
- `tests/policy-engine.test.mjs`
- `tests/settings-ui.test.mjs`
- `tests/background-event-wiring.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/plan-30-suspension-reason-transparency.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `npm run typecheck`
- `node --test tests/policy-engine.test.mjs tests/settings-ui.test.mjs tests/background-event-wiring.test.mjs`
- `npm run test`
- Manual Safari check for diagnostics readability and reason consistency.

## Exit Criteria
- Options shows deterministic per-tab suspend reason diagnostics.
- Diagnostics use existing reason taxonomy and do not alter policy behavior.
- Failure paths show clear non-blocking status.

## Rollback
- Revert Plan 30 files and rerun full tests.

## Dependencies / Cross-Plan References
- Leverages policy reason outputs established in Plan 3 and runtime flow from Plan 13/15.
- Can complement Plan 26 by surfacing pause/profile-derived reasons in future updates.

## Scoring
- Impact: 4
- Effort: 3
- Confidence: 4
- Priority Score: 13
