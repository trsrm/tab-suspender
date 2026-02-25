# Plan 6 - Essential Settings UI and Persistence

## Status
Not Implemented

## Goal
Implement essential settings and storage-backed persistence.

## Scope
- `idleMinutes`, `skipPinned`, `skipAudible`, and excluded-host inputs.
- Settings persistence and live application.

## Planned Steps
1. Build options form and validation.
2. Persist settings in extension storage.
3. Apply updated values in runtime policy.

## Planned Files
- `extension/options.html`
- `extension/src/options.ts`
- `extension/src/background.ts`
- `tests/settings.*`

## Planned Tests
- Defaults/parsing validation.
- Manual persistence across restart.

## Exit Criteria
- Settings persist and affect policy behavior.

## Rollback
- Revert options and storage integration.

## Decisions
- Pending implementation decisions recorded during execution.
