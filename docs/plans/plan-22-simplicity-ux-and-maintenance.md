# Plan 22 - Simplicity UX and Maintenance

## Status
Implemented

## Goal
Deliver low-effort, high-confidence UX/maintenance simplifications in options and suspended views while preserving existing guardrails and behavior contracts.

## Scope
- Split options-page status into independent channels:
  - settings status
  - recovery action status
- Centralize suspended-page user-facing status/copy messaging in grouped maps with explicit reason mapping.
- Add focused regression coverage for status-channel isolation.

## Non-goals
- No recovery-list structural refactor (view-model/row-helper extraction deferred).
- No policy, URL safety, or storage schema/version changes.
- No UX workflow additions or layout redesign.

## Implementation Steps
1. Added a dedicated `recoveryStatus` live-region in `extension/options.html`.
2. Updated `extension/src/options.ts`:
   - expanded `OptionsElements` with separate `settingsStatusEl` and `recoveryStatusEl`.
   - replaced shared `setStatus` with scoped `setSettingsStatus` and `setRecoveryStatus`.
   - routed settings load/save/validation messages to settings status only.
   - routed recovery reopen success/failure messages to recovery status only.
3. Updated `extension/src/suspended.ts`:
   - replaced ad hoc message constants with grouped `messages` map (`title`, `url`, `restore`, `copy`).
   - kept all existing user-visible strings unchanged.
   - mapped invalid restore reasons through explicit keyed lookup helper.
4. Updated `tests/settings-ui.test.mjs`:
   - added `recoveryStatus` DOM element in test fixtures.
   - updated reopen-success assertion to validate status-channel isolation.
   - added failure-path test asserting recovery failure message does not overwrite settings status.

## Files Added/Changed
- `extension/src/options.ts`
- `extension/src/suspended.ts`
- `extension/options.html`
- `tests/settings-ui.test.mjs`
- `docs/plans/plan-22-simplicity-ux-and-maintenance.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `node --test tests/settings-ui.test.mjs tests/restore-flow.test.mjs`
  - Result: passed (18 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (94 tests, 0 failures).

## Exit Criteria
- Settings and recovery actions use independent options-page status channels.
- Suspended-page user-facing copy/status text is centralized with explicit reason mappings.
- Existing restore/reopen behavior remains unchanged.
- Build, targeted tests, and full tests pass.

## Rollback
- Revert Plan 22 files:
  - `extension/options.html`
  - `extension/src/options.ts`
  - `extension/src/suspended.ts`
  - `tests/settings-ui.test.mjs`
  - `docs/plans/plan-22-simplicity-ux-and-maintenance.md`
  - `ROADMAP.md`
- Re-run `npm run build` and `npm run test`.

## Decisions
- Status updates in options are now domain-scoped (settings vs recovery) to prevent unrelated status overwrites.
- Suspended-page messaging is centralized via grouped maps while preserving exact existing strings for backward-compatible UX/tests.
- Recovery-list rendering structure was intentionally deferred as a lower-ROI scope item.

## Retrospective
- What changed: options status responsibilities are separated and suspended-page copy/state mapping is easier to maintain.
- Risks left: recovery-list rendering internals remain structurally unchanged and can still be improved in a future plan if maintenance cost rises.
