# Plan 30 - Suspension Reason Transparency

## Status
Implemented

## Goal
Add a read-only diagnostics panel in Options that explains, for current open tabs, why each tab is or is not suspend-eligible using the existing deterministic policy reason taxonomy.

## Scope
- Add manual-refresh diagnostics UI to Options.
- Add background runtime message endpoint for diagnostics snapshots.
- Reuse existing policy evaluation flow without behavior precedence changes.
- Show summary counts by reason and a bounded per-tab diagnostics list.

## Non-goals
- No telemetry or remote diagnostics.
- No policy precedence changes.
- No storage schema or manifest permission changes.
- No automatic settings recommendations or modifications.

## Implementation Steps
1. Added shared diagnostics request/response contracts and request type guard in `extension/src/types.ts`.
2. Extended `suspend-runner` with `getSuspendDiagnosticsSnapshot()` that:
   - reuses existing URL analysis/profile resolution/policy evaluation,
   - evaluates all open tabs for summary counts,
   - returns a bounded, deterministic tab list (`max 200`, reason-order then tabId order),
   - returns non-throwing failure payloads on tab-query errors.
3. Added `chrome.runtime.onMessage` handling in `background.ts` for `GET_SUSPEND_DIAGNOSTICS_SNAPSHOT`:
   - waits for runtime readiness,
   - returns typed success/failure diagnostics response,
   - keeps diagnostics path read-only (no tab updates/recovery writes).
4. Added Options diagnostics panel in `extension/options.html` + `extension/src/options.ts`:
   - manual `Refresh diagnostics` trigger,
   - dedicated diagnostics status channel,
   - summary text by reason (includes `eligible`),
   - per-tab rows (title + full URL + reason label),
   - empty and failure handling.
5. Added targeted automated coverage for diagnostics endpoint and options rendering states.

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/background/suspend-runner.ts`
- `extension/src/background.ts`
- `extension/src/options.ts`
- `extension/options.html`
- `tests/helpers/background-harness.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/settings-ui.test.mjs`
- `docs/architecture.md`
- `docs/plans/plan-30-suspension-reason-transparency.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `npm run typecheck`
  - Result: passed.
- Command: `node --test tests/background-event-wiring.test.mjs tests/settings-ui.test.mjs tests/policy-engine.test.mjs`
  - Result: passed (54 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (126 tests, 0 failures).

## Exit Criteria
- Options shows manual-refresh suspension diagnostics with summary counts and per-tab reasons.
- Diagnostics reasons come from the existing policy evaluator reason taxonomy.
- Diagnostics flow is local-only, read-only, and non-persistent.
- Failure/empty/truncated states are non-blocking and explicit.
- Targeted + full regression suites pass.

## Rollback
- Revert Plan 30 files listed above.
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Diagnostics refresh model is manual-only for v1.
- Per-tab diagnostics exposes title + full URL + reason label.
- Snapshot entry list is bounded to 200 rows for UI/runtime cost control; summary counts still evaluate all open tabs.
- Reason ordering in diagnostics mirrors deterministic policy precedence ordering.

## Retrospective
- What changed: users can self-diagnose why tabs are not suspending without external tools or runtime mutations.
- Risks left: manual Safari verification is still needed to evaluate readability/performance with very large real-world tab sets.
