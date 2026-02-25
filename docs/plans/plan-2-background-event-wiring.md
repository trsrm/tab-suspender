# Plan 2 - Background Event Wiring

## Status
Not Implemented

## Goal
Implement activity tracking only, without suspending tabs.

## Scope
- Wire tab/window event listeners.
- Track `lastActiveAtMs` and `lastUpdatedAtMs` in bounded state.

## Planned Steps
1. Add activation/update/focus listeners in background logic.
2. Update activity records on events.
3. Add tests for state update behavior.

## Planned Files
- `extension/src/background.ts`
- `extension/background.js`
- `tests/*` for event/state validation

## Planned Tests
- Unit tests for timestamp updates and state lifecycle.
- Manual log verification for listener firing.

## Exit Criteria
- Activity tracking is correct with no tab navigation side effects.

## Rollback
- Revert listener and state tracking changes.

## Decisions
- Pending implementation decisions recorded during execution.
