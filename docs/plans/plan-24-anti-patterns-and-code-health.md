# Plan 24 - Anti-Patterns and Code Health

## Status
Implemented

## Goal
Harden internal code-health contracts by replacing implicit payload/message assumptions with explicit typed guards and by expanding invariant-level storage tests, without changing user-facing behavior or storage schemas.

## Scope
- Background event payload contract hardening via shared typed guards.
- Options-page status/copy literal centralization into typed message maps with string parity.
- Explicit decode/sanitize invariant comments and direct store test coverage expansion.

## Non-goals
- No feature additions.
- No suspend policy behavior changes.
- No storage schema/key/version changes.
- No permissions/runtime surface expansion.

## Implementation Steps
1. Added shared payload contracts and guards in `extension/src/types.ts`:
   - `TabUpdatedChangeInfo`
   - `StorageChange`
   - `StorageOnChangedMap`
   - `isMeaningfulTabUpdatedChangeInfo(...)`
   - `isStorageOnChangedMap(...)`
   - `isStorageChange(...)`
2. Updated `extension/src/background.ts` to consume shared guards instead of local ad hoc payload typing for:
   - `tabs.onUpdated` meaningful-change detection
   - `storage.onChanged` settings change payload gating
3. Centralized options-page user-facing statuses in `extension/src/options.ts` via a typed `optionsMessages` map:
   - settings status
   - recovery status/labels
   - idle-hours validation text
   - retained exact existing strings
4. Added concise invariant comments in:
   - `extension/src/settings-store.ts`
   - `extension/src/activity-store.ts`
   - `extension/src/recovery-store.ts`
5. Expanded direct store tests:
   - added `tests/settings-store.test.mjs`
   - added `tests/activity-store.test.mjs`
   - extended `tests/recovery-store.test.mjs` with trim/cap coverage

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/background.ts`
- `extension/src/options.ts`
- `extension/src/settings-store.ts`
- `extension/src/activity-store.ts`
- `extension/src/recovery-store.ts`
- `tests/settings-store.test.mjs` (new)
- `tests/activity-store.test.mjs` (new)
- `tests/recovery-store.test.mjs`
- `docs/architecture.md`
- `docs/plans/plan-24-anti-patterns-and-code-health.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `node --test tests/settings-store.test.mjs tests/activity-store.test.mjs tests/recovery-store.test.mjs tests/settings-ui.test.mjs tests/settings-runtime.test.mjs tests/background-event-wiring.test.mjs`
  - Result: passed (42 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (103 tests, 0 failures).

## Exit Criteria
- Background payload contracts are explicit and shared.
- Options status literals are centralized with no string behavior drift.
- Dedicated settings/activity store decode/sanitize tests exist; recovery-store coverage expanded.
- Build, targeted tests, and full suite pass.

## Rollback
- Revert Plan 24 files:
  - `extension/src/types.ts`
  - `extension/src/background.ts`
  - `extension/src/options.ts`
  - `extension/src/settings-store.ts`
  - `extension/src/activity-store.ts`
  - `extension/src/recovery-store.ts`
  - `tests/settings-store.test.mjs`
  - `tests/activity-store.test.mjs`
  - `tests/recovery-store.test.mjs`
  - `docs/architecture.md`
  - `docs/plans/plan-24-anti-patterns-and-code-health.md`
  - `ROADMAP.md`
- Re-run:
  - `npm run build`
  - `npm run test`

## Decisions
- Replaced stale draft assumption about runtime message listeners with current event-payload contract hardening (no `runtime.onMessage` path exists now).
- Kept all options-page user-facing status strings exactly unchanged while centralizing literal ownership.
- Added direct store tests at module level to lock sanitize/decode invariants independent of higher-level runtime tests.

## Retrospective
- What changed: payload/state contracts are now explicit in shared types, options message ownership is centralized, and store invariants are covered by dedicated tests.
- Risks left: manual Safari smoke checks remain useful for browser-integration confidence beyond Node harness coverage.
