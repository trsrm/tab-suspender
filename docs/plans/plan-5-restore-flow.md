# Plan 5 - Restore Flow + URL Safety Guards

## Status
Implemented

## Goal
Restore suspended tabs safely and add URL guardrails.

## Scope
- Implement restore interaction on the suspended page.
- Validate payload URLs with deterministic protocol and size guardrails.
- Apply URL-length guardrails during suspend eligibility evaluation.
- Preserve non-breaking fallback behavior for invalid restore payloads.

## Implementation Steps
1. Added shared URL safety helper with fixed max length (`2048`) and explicit validation result reasons.
2. Wired URL-length guard production into background policy flags while preserving evaluator precedence (`internalUrl` remains ahead of `urlTooLong`).
3. Hardened suspend payload builder to reject non-restorable URLs before payload encoding.
4. Implemented restore enablement/disablement in suspended page based on payload URL validation.
5. Added restore click handling via `location.replace(...)` with in-progress and failure status states.
6. Expanded suspend action tests for oversized URL guard behavior in both sweep and action-click paths.
7. Added dedicated restore flow tests for valid restore, invalid payload fallback states, and navigation failure handling.
8. Ran typecheck, targeted Plan 5 tests, and full regression test suite.

## Files Added/Changed
- `extension/src/url-safety.ts`
- `extension/src/background.ts`
- `extension/src/suspended.ts`
- `extension/suspended.html`
- `tests/suspend-action.test.mjs`
- `tests/restore-flow.test.mjs`
- `docs/plans/plan-5-restore-flow.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run build && node --test tests/suspend-action.test.mjs tests/restore-flow.test.mjs`
  - Result: passed (15 tests, 0 failures), including oversized URL guard checks and restore success/failure payload scenarios.
- Command: `npm run test`
  - Result: passed (39 tests, 0 failures).

## Exit Criteria
- Restore button is enabled only for valid restorable payload URLs.
- Valid restore navigates back to the original URL in the current tab.
- Invalid or oversized payload URLs never trigger unsafe navigation.
- Suspend flow rejects oversized URLs in both periodic sweep and action-click paths.
- Plan 5 tests and full test suite pass.

## Rollback
- Revert Plan 5 changes in:
  - `extension/src/url-safety.ts`
  - `extension/src/background.ts`
  - `extension/src/suspended.ts`
  - `extension/suspended.html`
  - `tests/suspend-action.test.mjs`
  - `tests/restore-flow.test.mjs`
  - `docs/plans/plan-5-restore-flow.md`
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Shared URL guardrails are centralized in `validateRestorableUrl(...)` and reused by both suspend and restore paths.
- Maximum restorable URL length is fixed at `2048` characters.
- Allowed restorable protocols are limited to `http:` and `https:`.

## Retrospective
- What changed: suspended tabs can now be restored directly from the suspended page with explicit payload validation and graceful failure states; suspend flow now enforces URL-length guardrails.
- Risks left: settings-driven tuning and exclusion matching behavior remain deferred to Plans 6 and 7.
