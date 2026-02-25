# Plan 7 - Domain Exclusions With Wildcards

## Status
Implemented

## Goal
Add exact and wildcard hostname exclusions.

## Scope
- Rule normalization and wildcard matching (`*.example.com`).
- Policy integration with exclusion matcher.

## Implementation Steps
1. Added `extension/src/matcher.ts` with pure helpers for exclusion-rule normalization and URL hostname matching.
2. Implemented canonical host rule support for exact (`example.com`) and wildcard subdomain rules (`*.example.com`) with deterministic validation.
3. Refactored `settings-store` exclusion sanitization to use the shared matcher normalization path.
4. Updated options save flow to preserve the existing Save behavior while surfacing a non-blocking warning when invalid exclusion entries are ignored.
5. Updated options hint text to document supported wildcard semantics.
6. Integrated host exclusion matching into background policy input creation via `flags.excludedHost`.
7. Added matcher unit tests and expanded runtime/action/options tests to verify exact and wildcard exclusion behavior.
8. Ran typecheck, targeted Plan 7 tests, and full regression suite.

## Files Added/Changed
- `extension/src/matcher.ts`
- `extension/src/settings-store.ts`
- `extension/src/options.ts`
- `extension/options.html`
- `extension/src/background.ts`
- `tests/matcher.test.mjs`
- `tests/settings-ui.test.mjs`
- `tests/settings-runtime.test.mjs`
- `tests/suspend-action.test.mjs`
- `docs/plans/plan-7-domain-exclusions.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run build && node --test tests/matcher.test.mjs tests/settings-ui.test.mjs tests/settings-runtime.test.mjs tests/suspend-action.test.mjs tests/policy-engine.test.mjs`
  - Result: passed (44 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (57 tests, 0 failures).

## Exit Criteria
- Excluded host tabs are never suspended in sweep and action-click flows.
- Exact and wildcard exclusion semantics are deterministic and documented.
- Invalid excluded-host entries are ignored with non-blocking options feedback.
- Plan 7 targeted tests and full suite pass.

## Rollback
- Revert Plan 7 changes in:
  - `extension/src/matcher.ts`
  - `extension/src/settings-store.ts`
  - `extension/src/options.ts`
  - `extension/options.html`
  - `extension/src/background.ts`
  - `tests/matcher.test.mjs`
  - `tests/settings-ui.test.mjs`
  - `tests/settings-runtime.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `docs/plans/plan-7-domain-exclusions.md`
  - `ROADMAP.md`
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Wildcard exclusions are subdomain-only: `*.example.com` matches `a.example.com` and deeper, but not `example.com`.
- Invalid exclusion entries are dropped during normalization, while valid entries persist in the same save operation.
- Runtime matching uses URL hostname only and supports DNS-style hostnames plus `localhost`.

## Retrospective
- What changed: exclusions now participate in suspend policy decisions and block suspend for exact/wildcard host matches across automated sweep and manual action-click flows.
- Risks left: final release-readiness documentation and QA hardening remain in Plan 8.
