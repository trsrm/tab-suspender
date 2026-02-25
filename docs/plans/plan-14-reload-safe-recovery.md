# Plan 14 - Reload-Safe Recovery for Suspended Tabs

## Status
Implemented

## Goal
Add a durable fallback path for users who lose suspended tabs after Safari extension reloads by persisting a bounded recovery ledger and surfacing one-click reopen actions in Options.

## Scope
- Persist a versioned recovery entry after each successful suspend navigation.
- Store recovery entries as sanitized, deduped, bounded local data.
- Add Options UI section for recently suspended tabs with per-entry reopen actions.
- Keep reopen eligibility gated by URL safety validation.
- Add regression tests for recovery persistence, dedupe/cap behavior, and options reopen flow.

## Implementation Steps
1. Added recovery schema types (`RecoveryEntry`, `StoredRecoveryStateV1`) to shared types.
2. Added `recovery-store.ts` with versioned storage key (`recoveryState`), decode/sanitize helpers, URL validation, URL-level dedupe, and 100-entry cap.
3. Wired background suspend success path to append recovery entries and persist them through a dedicated serialized queue.
4. Hydrated recovery state at runtime startup alongside settings/activity hydration.
5. Extended options UI with a `Recently Suspended Tabs` section showing title, URL, capture timestamp, and `Reopen` button.
6. Added tabs-create compatibility wrapper in options script to support callback/promise API variants and non-blocking failure status messaging.
7. Expanded test harness and suites for recovery persistence success/failure and options recovery UI interactions.

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/recovery-store.ts`
- `extension/src/background.ts`
- `extension/options.html`
- `extension/src/options.ts`
- `tests/helpers/background-harness.mjs`
- `tests/suspend-action.test.mjs`
- `tests/settings-ui.test.mjs`
- `tests/recovery-store.test.mjs`
- `README.md`
- `ROADMAP.md`
- `docs/plans/README.md`
- `docs/plans/plan-14-reload-safe-recovery.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `node --test tests/suspend-action.test.mjs tests/settings-ui.test.mjs`
  - Result: passed (23 tests, 0 failures), including recovery ledger persistence, dedupe/cap retention, recovery-write-failure resilience, and options reopen flow coverage.
- Command: `npm test`
  - Result: passed (73 tests, 0 failures), including new `recovery-store` decode/save/load tests.

## Exit Criteria
- Successful suspend writes recoverable URL entries to versioned storage.
- Recovery storage sanitizes invalid payloads, dedupes by URL, and caps retention at 100 entries.
- Options page shows recent entries and reopens valid URLs in new tabs.
- Invalid/unrestorable recovery URLs are not reopenable.
- Recovery persistence failures do not block suspend behavior.
- Targeted + full regression suites pass.

## Rollback
- Revert Plan 14 changes in:
  - `extension/src/types.ts`
  - `extension/src/recovery-store.ts`
  - `extension/src/background.ts`
  - `extension/options.html`
  - `extension/src/options.ts`
  - `tests/helpers/background-harness.mjs`
  - `tests/suspend-action.test.mjs`
  - `tests/settings-ui.test.mjs`
  - `tests/recovery-store.test.mjs`
  - `README.md`
  - `ROADMAP.md`
  - `docs/plans/README.md`
  - `docs/plans/plan-14-reload-safe-recovery.md`
- Re-run `npm test` to validate rollback baseline.

## Decisions
- Recovery fallback is manual and options-driven (no automatic reopen side effects).
- Recovery list stores URL/title/minute only, with URL as dedupe key.
- Reopen action uses existing URL safety rules (`validateRestorableUrl(...)`) to keep recovery behavior aligned with restore guardrails.

## Retrospective
- What changed: users now have a durable fallback to reopen recently suspended tabs after extension reload/window-loss incidents.
- Risks left: manual Safari verification is still needed to validate behavior under real extension reload lifecycle edge cases.
