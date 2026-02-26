# Plan 18 - YAGNI Pruning Opportunities (Y18-1 + Y18-2 + Y18-3)

## Status
Implemented

## Goal
Remove speculative or legacy runtime surface area that does not provide current v1 product value while preserving user-visible suspension behavior.

## Scope
- Remove legacy `runtime.onMessage` PING surface from production background runtime.
- Consolidate duplicated storage callback/promise compatibility wrappers into one shared storage adapter.
- Reduce `background.ts` `__testing` exports to only hooks currently required by tests.
- Keep policy behavior, storage schema, and UI behavior unchanged.

## Non-goals
- No policy precedence or timeout behavior changes.
- No schema version bump for settings/activity/recovery envelopes.
- No options/suspended page UX changes.

## Implementation Steps
1. Inventoried active `__testing` usage and removed unused hook exports.
2. Removed the background `runtime.onMessage` listener and legacy PING response path.
3. Added shared storage adapter module:
   - `resolveStorageArea(...)`
   - `getKeyWithCompatibility(...)`
   - `setItemsWithCompatibility(...)`
4. Refactored `settings-store`, `activity-store`, and `recovery-store` to use shared adapter helpers.
5. Removed obsolete message-listener assertions/tests from background wiring tests.
6. Updated architecture/roadmap plan records and decision log.

## Files Added/Changed
- `extension/src/storage-compat.ts` (new)
- `extension/src/background.ts`
- `extension/src/background/activity-runtime.ts`
- `extension/src/settings-store.ts`
- `extension/src/activity-store.ts`
- `extension/src/recovery-store.ts`
- `tests/background-event-wiring.test.mjs`
- `tests/helpers/background-harness.mjs`
- `docs/architecture.md`
- `docs/plans/plan-18-yagni-pruning-opportunities.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `node --test tests/background-event-wiring.test.mjs tests/settings-runtime.test.mjs tests/recovery-store.test.mjs tests/suspend-action.test.mjs`
  - Result: passed (38 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (80 tests, 0 failures).

## Exit Criteria
- Legacy PING runtime message API removed from production background runtime.
- Shared storage compatibility adapter replaces duplicated wrapper logic across all three stores.
- `background.ts` `__testing` surface reduced to active requirements.
- Targeted + full regression suites pass.

## Rollback
- Revert Plan 18 touched files listed above.
- Re-run:
  - `npm run build`
  - `npm run test`

## Decisions
- Runtime messaging is not a supported v1 background API surface; remove PING instead of versioning it.
- Shared storage compatibility behavior is centralized now (superseding overlap with Plan 19 draft item `D19-1`).
- Keep only currently used `__testing` hooks to avoid production coupling to test-only convenience APIs.

## Retrospective
- What changed: runtime and store surface area is smaller, with one storage compatibility implementation and no stale message contract.
- Risks left: if future Safari API behavior diverges, compatibility adjustments now route through one shared adapter and should be covered by targeted storage tests.
