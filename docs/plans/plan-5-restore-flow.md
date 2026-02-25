# Plan 5 - Restore Flow + URL Safety Guards

## Status
Not Implemented

## Goal
Restore suspended tabs safely and add URL guardrails.

## Scope
- Implement restore interaction.
- Validate payload URL and guard against oversized values.

## Planned Steps
1. Add restore button handler to navigate back to original URL.
2. Add URL validation and max-length checks.
3. Add safe fallback for invalid payloads.

## Planned Files
- `extension/src/suspended.ts`
- `extension/src/background.ts`
- `tests/restore.*`

## Planned Tests
- Restore success/failure cases.
- Oversized URL guard behavior.

## Exit Criteria
- Restore is reliable and guardrails prevent breakage.

## Rollback
- Revert restore/guard logic.

## Decisions
- Pending implementation decisions recorded during execution.
