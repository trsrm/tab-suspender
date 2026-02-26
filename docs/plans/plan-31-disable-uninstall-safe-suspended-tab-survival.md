# Plan 31 - Disable/Uninstall-Safe Suspended Tab Survival

## Status
Implemented

## Goal
Prevent suspended tabs from being lost when extension pages become unavailable (disable/uninstall) by switching suspension output to a self-contained `data:` document that can restore the original URL without extension runtime dependencies.

## Scope
- Replace `safari-extension://.../suspended.html?...` suspend destination with a generated `data:text/html` suspended document.
- Keep URL safety guardrails unchanged (`http/https`, max length `2048`).
- Keep recovery ledger behavior unchanged (same storage schema/key and reopen flow).
- Preserve compatibility for previously suspended extension-page URLs while extension runtime is enabled.

## Non-goals
- No telemetry, remote services, or external page hosting.
- No policy precedence changes.
- No redesign of settings or recovery schema.

## Implementation Steps
1. Added shared payload module (`suspended-payload.ts`) to centralize payload title sanitization, extension-page payload decoding, data-URL payload decoding, and data-URL suspended document generation.
2. Updated background suspend destination builder to emit self-contained `data:` suspended pages.
3. Replaced extension-page-only suspended detection with dual-format detection:
   - signature-validated `data:` suspended pages
   - legacy `safari-extension://.../suspended.html?...` payload pages
4. Kept recovery tracking pipeline unchanged so suspend success still appends URL/title/minute entries and persists through existing queued writes.
5. Refactored `suspended.ts` to reuse shared search-parameter payload decode utility (legacy path compatibility).
6. Updated suspend-action tests to validate data-URL payload round-trip, signature detection, and skip behavior for both formats.
7. Updated architecture/readme/roadmap/plans index documentation.

## Files Added/Changed
- `extension/src/suspended-payload.ts`
- `extension/src/types.ts`
- `extension/src/background.ts`
- `extension/src/suspended.ts`
- `tests/suspend-action.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/README.md`
- `docs/plans/plan-31-disable-uninstall-safe-suspended-tab-survival.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `npm run typecheck`
  - Result: passed.
- Command: `node --test tests/suspend-action.test.mjs tests/restore-flow.test.mjs tests/background-event-wiring.test.mjs tests/recovery-store.test.mjs`
  - Result: passed (42 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (81 tests, 0 failures).

## Exit Criteria
- Eligible tabs suspend to `data:text/html` URLs containing signed self-contained restore UI.
- Suspended tabs remain restorable without extension runtime presence.
- Existing legacy extension suspended tabs are still recognized and not re-suspended.
- Recovery ledger behavior remains intact.
- Requested targeted + full regression suites pass.

## Rollback
- Revert Plan 31 changes in:
  - `extension/src/suspended-payload.ts`
  - `extension/src/types.ts`
  - `extension/src/background.ts`
  - `extension/src/suspended.ts`
  - `tests/suspend-action.test.mjs`
  - `README.md`
  - `docs/architecture.md`
  - `docs/plans/README.md`
  - `docs/plans/plan-31-disable-uninstall-safe-suspended-tab-survival.md`
  - `ROADMAP.md`
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Data-URL suspended page is the default and only new suspension format for v1 survival behavior.
- Data-URL detection is signature-based and payload-parse validated to avoid false positives.
- Legacy extension-page suspended tabs remain backward-compatible via shared decode path.

## Retrospective
- What changed: suspended tabs are now self-contained documents that survive extension disable/uninstall and still restore safely.
- Risks left: manual Safari verification is still needed to confirm disable/uninstall behavior in the real browser lifecycle.
