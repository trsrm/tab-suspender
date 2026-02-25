# Plan 6 - Essential Settings UI and Persistence

## Status
Implemented

## Goal
Implement essential settings and storage-backed persistence.

## Scope
- Real options form for `idleMinutes`, `skipPinned`, `skipAudible`, and `excludedHosts`.
- Versioned settings persistence in `chrome.storage.local`.
- Live runtime settings updates in background policy evaluation.
- Keep excluded hosts persisted-only for this plan (runtime matching deferred to Plan 7).

## Implementation Steps
1. Added shared settings storage helpers with schema envelope (`schemaVersion: 1`) and canonical storage key (`settings`).
2. Added deterministic settings sanitization: idle timeout integer clamp (`1..1440`), strict booleans, and normalized/deduped excluded-host list with host and list size caps.
3. Updated background runtime to hydrate settings from storage at startup, await hydration before suspend evaluation, and apply storage change updates live via `chrome.storage.onChanged`.
4. Replaced options placeholder with an accessible, editable settings form and explicit Save flow.
5. Implemented options runtime logic for initial load, field-level idle timeout validation, save persistence, and deterministic status messaging.
6. Extended existing background-related test mocks with `chrome.storage.local` and `chrome.storage.onChanged` support.
7. Added Plan 6 test suites for options persistence UX and runtime settings behavior.
8. Ran typecheck, targeted Plan 6 tests, and full regression suite.

## Files Added/Changed
- `extension/src/settings-store.ts`
- `extension/src/types.ts`
- `extension/src/background.ts`
- `extension/src/options.ts`
- `extension/options.html`
- `tests/settings-ui.test.mjs`
- `tests/settings-runtime.test.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `docs/plans/plan-6-settings-ui.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run build && node --test tests/settings-ui.test.mjs tests/settings-runtime.test.mjs`
  - Result: passed (8 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (47 tests, 0 failures).

## Exit Criteria
- Settings UI is editable, accessible, and no longer scaffold-only.
- Settings persist through versioned local storage envelope (`schemaVersion: 1`).
- Runtime policy uses persisted `idleMinutes`, `skipPinned`, and `skipAudible` without restart.
- Excluded hosts are persisted and normalized, with runtime matching intentionally deferred to Plan 7.
- Plan 6 targeted tests and full suite pass.

## Rollback
- Revert Plan 6 changes in:
  - `extension/src/settings-store.ts`
  - `extension/src/types.ts`
  - `extension/src/background.ts`
  - `extension/src/options.ts`
  - `extension/options.html`
  - `tests/settings-ui.test.mjs`
  - `tests/settings-runtime.test.mjs`
  - `tests/background-event-wiring.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `docs/plans/plan-6-settings-ui.md`
  - `ROADMAP.md`
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Persisted settings use a versioned envelope (`schemaVersion: 1`) at `chrome.storage.local["settings"]`.
- Excluded hosts are persisted now, but policy-level host exclusion remains deferred to Plan 7.
- Options persistence uses explicit Save submission (no autosave).
- Idle timeout validation in options UI rejects non-integer/out-of-range values before write.

## Retrospective
- What changed: settings are now first-class and persistent, with shared sanitization and live background application.
- Risks left: exclusion matcher semantics (`*.example.com`, normalization/matching rules) remain for Plan 7.
