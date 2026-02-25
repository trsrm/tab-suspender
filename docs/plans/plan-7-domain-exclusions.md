# Plan 7 - Domain Exclusions With Wildcards

## Status
Not Implemented

## Goal
Add exact and wildcard hostname exclusions.

## Scope
- Rule normalization and wildcard matching (`*.example.com`).
- Policy integration with exclusion matcher.

## Planned Steps
1. Implement matcher and normalization.
2. Add options-side validation.
3. Integrate matcher into policy checks.

## Planned Files
- `extension/src/matcher.ts`
- `extension/src/options.ts`
- `extension/src/policy.ts`
- `tests/matcher.*`

## Planned Tests
- Exact/wildcard/edge-case matcher coverage.

## Exit Criteria
- Excluded host tabs are never suspended.

## Rollback
- Revert matcher and policy integration.

## Decisions
- Pending implementation decisions recorded during execution.
