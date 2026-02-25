# Plan 4 - Suspend Action + Lightweight Suspended Screen

## Status
Implemented

## Goal
Suspend eligible tabs by navigating to a lightweight internal suspended page.

## Scope
- Build suspended URL payload (`u`, `t`, `ts`) with deterministic encoding.
- Suspend tabs from two triggers: periodic sweep and action click.
- Keep suspended page lightweight, accessible, and restore-disabled until Plan 5.

## Implementation Steps
1. Added default settings and periodic alarm scheduling for a 1-minute suspend sweep.
2. Integrated policy evaluation into background suspend pipeline with safe per-tab failure handling.
3. Added toolbar-action suspend path that bypasses only `active` and idle-timeout gates while preserving pinned/audible/internal guards.
4. Added suspended payload builder and query-param encoding for `u`, `t`, and `ts`.
5. Updated suspended page UI + script to decode and render payload fields.
6. Expanded background wiring tests and added dedicated suspend action tests.
7. Ran typecheck and full automated test suite.

## Files Added/Changed
- `extension/src/background.ts`
- `extension/src/suspended.ts`
- `extension/suspended.html`
- `extension/src/types.ts`
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `docs/plans/plan-4-suspend-action.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run test`
  - Result: passed (32 tests, 0 failures), including Plan 4 suspend sweep, action click, payload round-trip, and failure handling coverage.

## Exit Criteria
- Automatic sweep suspends eligible idle tabs via policy decisions.
- Action click suspends active tabs immediately while preserving pinned/audible/internal safety checks.
- Payload fields `u`, `t`, and `ts` are encoded and decoded correctly.
- Suspended page remains lightweight with restore explicitly deferred to Plan 5.

## Rollback
- Revert Plan 4 changes in:
  - `extension/src/background.ts`
  - `extension/src/suspended.ts`
  - `extension/suspended.html`
  - `extension/src/types.ts`
  - `tests/background-event-wiring.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `docs/plans/plan-4-suspend-action.md`
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Default runtime settings remain hardcoded in background for Plan 4 (`idleMinutes=60`, `skipPinned=true`, `skipAudible=true`, `excludedHosts=[]`) until Plan 6 persistence.
- Periodic suspend evaluation runs every minute via alarm `suspend-sweep-v1`.
- Action click intentionally bypasses only `active` and timeout guards; pinned/audible/internal URL protections remain enforced.
- URL exclusion matching and explicit URL-length safety flags remain deferred to Plans 5 and 7.

## Retrospective
- What changed: suspension is now functional through both automated idle sweep and manual action click, with deterministic payload encoding and lightweight suspended-page rendering.
- Risks left: restore behavior, payload validation hardening, and exclusion matcher integration remain pending Plans 5 and 7.
