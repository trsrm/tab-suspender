# Plan 4 - Suspend Action + Lightweight Suspended Screen

## Status
Not Implemented

## Goal
Suspend eligible tabs by navigating to a lightweight internal suspended page.

## Scope
- Build suspended URL payload (`u`, `t`, `ts`).
- Navigate eligible tabs to suspended screen.

## Planned Steps
1. Add suspend URL encoding path.
2. Integrate policy decisions with navigation action.
3. Keep suspended page light and accessible.

## Planned Files
- `extension/src/background.ts`
- `extension/src/suspended.ts`
- `extension/suspended.html`
- `tests/suspend-url.*`

## Planned Tests
- Payload encode/decode tests.
- Manual suspend-flow verification.

## Exit Criteria
- Eligible tabs suspend reliably.

## Rollback
- Disable suspend navigation changes.

## Decisions
- Pending implementation decisions recorded during execution.
