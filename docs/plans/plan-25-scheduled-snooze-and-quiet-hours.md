# Plan 25 - Scheduled Snooze and Quiet Hours

## Status
Draft

## Goal
Allow users to pause automatic suspension intentionally, either as a one-off snooze interval or during recurring quiet-hour windows.

## Scope
- Add options controls for:
  - one-off snooze durations (for example 30m/1h/2h/custom)
  - weekly quiet-hour schedule windows (day/time ranges)
- Apply pause logic only to automatic sweeps (manual suspend actions remain available).
- Keep existing safety guardrails and URL validation unchanged.

## Non-goals
- No redesign of policy precedence beyond a top-level `snoozed`/`quietHoursActive` gate.
- No cloud sync or account-based schedules.
- No packaging or distribution work.

## User Value
- Reduces surprise suspensions during focused work sessions and predictable routines.
- Adds clear user control while preserving default automated behavior outside pause windows.

## Proposed UX/API/Data Model Changes
- UX:
  - Add `Pause Auto-Suspend` section in Options with snooze controls and active-until indicator.
  - Add `Quiet Hours` schedule editor with add/remove windows and enable toggle.
- API/runtime:
  - Background sweep adds a pre-policy skip gate when snooze/quiet-hours are active.
- Data model/storage (anticipated):
  - New versioned storage key or settings-envelope extension for `pauseState`:
    - `snoozeUntilMinute?: number`
    - `quietHoursEnabled: boolean`
    - `quietWindows: QuietWindow[]`
- Types/interfaces (anticipated):
  - Add `QuietWindow`, `PauseState`, and derived runtime eligibility helper signatures.
- Manifest (anticipated):
  - No new permissions required.

## Risks and Failure Modes
- Time-zone/DST boundaries can cause schedule ambiguity.
- Overlapping windows may produce confusing effective behavior.
- Service worker restarts could drop in-memory pause state if persistence/hydration is incomplete.

## Implementation Steps
1. Define persisted pause/quiet-hours schema with strict sanitization and bounds.
2. Add options UI controls and validation for snooze durations and quiet windows.
3. Hydrate/persist pause state in background runtime and apply gate before sweep eligibility evaluation.
4. Add deterministic unit tests for schedule matching, snooze expiry, restart durability, and conflict resolution.
5. Update docs and roadmap records.

## Files Expected to Change
- `extension/src/types.ts`
- `extension/src/settings-store.ts` and/or new `pause-store.ts`
- `extension/src/background.ts`
- `extension/src/options.ts`
- `extension/options.html`
- `tests/settings-ui.test.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/plan-25-scheduled-snooze-and-quiet-hours.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `npm run typecheck`
- `node --test tests/settings-ui.test.mjs tests/background-event-wiring.test.mjs tests/suspend-action.test.mjs`
- `npm run test`
- Manual Safari check for quiet-hours behavior around local-time boundaries.

## Exit Criteria
- User can set and clear one-off snooze from Options.
- User can configure recurring quiet-hour windows that suppress auto-suspend during active windows.
- Pause state survives extension worker restarts.
- Existing manual suspend and safety guardrails remain unchanged.

## Rollback
- Revert only Plan 25 touched files.
- Re-run `npm run test` and verify baseline sweep behavior restored.

## Dependencies / Cross-Plan References
- May leverage Plan 30 diagnostics to surface active pause reasons.
- Should avoid overlap with Plan 26 per-site overrides by keeping pause global.

## Scoring
- Impact: 5
- Effort: 3
- Confidence: 4
- Priority Score: 17
