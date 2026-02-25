# Plan 2 - Background Event Wiring (Minute Precision)

## Status
Implemented

## Goal
Implement activity tracking only, without suspending tabs, using minute-level precision.

## Scope
- Wire tab/window activity listeners in background logic.
- Track `lastActiveAtMinute` and `lastUpdatedAtMinute` in bounded in-memory state.
- Seed activity state from active tabs at startup.
- Add deterministic tests for event-driven state updates.

## Implementation Steps
1. Added activity state map keyed by `tabId` and minute-based timestamp helpers.
2. Wired listeners for `onActivated`, `onUpdated`, `onFocusChanged`, `onRemoved`, and `onReplaced`.
3. Added startup seeding from `chrome.tabs.query({ active: true })`.
4. Added internal `__testing` helpers for deterministic test assertions.
5. Added automated tests covering listener registration, state transitions, lifecycle cleanup, minute precision, and unchanged `PING` behavior.

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/background.ts`
- `tests/background-event-wiring.test.mjs`
- `build/extension/background.js` (generated runtime artifact)

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run test`
  - Result: passed (7 tests total; 5 Plan 2 behavior tests + 2 scaffold baseline tests).

## Exit Criteria
- Activity tracking updates correctly for activate, update, focus, remove, and replace events.
- Activity state lifecycle remains bounded via remove/replace cleanup.
- Minute-level precision is enforced in stored timestamps.
- No suspend/restore navigation behavior was introduced.

## Rollback
- Revert Plan 2 changes in:
  - `extension/src/types.ts`
  - `extension/src/background.ts`
  - `tests/background-event-wiring.test.mjs`
  - Rebuild runtime outputs with `npm run build`

## Decisions
- Use explicit minute-based names (`lastActiveAtMinute`, `lastUpdatedAtMinute`) instead of `*AtMs`.
- Use numeric epoch-minute integers (`Math.floor(Date.now() / 60000)`), not strings.
- Seed startup state from active tabs only.
- Expose internal `__testing` accessors for deterministic Node-based behavior tests.

## Retrospective
- What changed: background activity tracking now exists with deterministic tests and no suspend side effects.
- Risks left: state is memory-only until later plans introduce persistence and policy-driven suspend flow.
