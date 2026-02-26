# Plan 26 - Per-Site Policy Profiles

## Status
Implemented

## Goal
Allow host-scoped policy overrides so users can tune suspend behavior for specific domains without changing global defaults.

## Scope
- Add per-site profiles with deterministic match precedence over global settings for matching hosts.
- Keep host syntax aligned with existing exclusion semantics (`example.com`, `*.example.com` subdomain-only wildcard).
- Add Options UI CRUD for profiles.
- Resolve effective policy settings per tab before policy evaluation.

## Non-goals
- No regex host matching.
- No remote sync.
- No new extension permissions.
- No policy precedence order changes in `evaluateSuspendDecision`.

## Implementation Steps
1. Extended shared types with `SiteProfile`, `SiteProfileOverrides`, `ResolvedPolicySettings`, and `Settings.siteProfiles`.
2. Upgraded settings envelope schema to v2 (`schemaVersion: 2`) with decode-time v1 migration and sanitization.
3. Added matcher helpers for profile host normalization and deterministic profile resolution precedence:
   - exact host > wildcard
   - longer host target > shorter
   - earliest row as tie-break
4. Integrated effective settings resolution into suspend runtime (`suspend-runner.ts`) for sweep and action-click paths, including `excludeFromSuspend` behavior.
5. Updated sweep query pre-filtering to avoid pinned/audible filtering when site profiles exist, preventing false-negative candidates.
6. Added Options `Site Profiles` section with add/delete/edit controls and save-time validation/sanitization.
7. Extended tests for schema migration, profile normalization/matching precedence, runtime override behavior, and options CRUD/status messaging.
8. Updated README, architecture notes, and roadmap tracking/decision log.

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/settings-store.ts`
- `extension/src/matcher.ts`
- `extension/src/background/suspend-runner.ts`
- `extension/src/background.ts`
- `extension/src/options.ts`
- `extension/options.html`
- `tests/matcher.test.mjs`
- `tests/settings-store.test.mjs`
- `tests/policy-engine.test.mjs`
- `tests/settings-ui.test.mjs`
- `tests/suspend-action.test.mjs`
- `tests/settings-runtime.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/plan-26-per-site-policy-profiles.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `npm run typecheck`
  - Result: passed.
- Command: `node --test tests/matcher.test.mjs tests/settings-store.test.mjs tests/policy-engine.test.mjs tests/settings-ui.test.mjs tests/suspend-action.test.mjs`
  - Result: passed (67 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (112 tests, 0 failures).

## Exit Criteria
- Per-site profile CRUD is available in Options and persisted in settings schema v2.
- Effective per-tab policy resolution is deterministic and test-covered.
- Existing global behavior remains unchanged when no profile matches.
- Required build/typecheck/targeted/full test gates pass.

## Rollback
- Revert Plan 26 changes in:
  - `extension/src/types.ts`
  - `extension/src/settings-store.ts`
  - `extension/src/matcher.ts`
  - `extension/src/background/suspend-runner.ts`
  - `extension/src/background.ts`
  - `extension/src/options.ts`
  - `extension/options.html`
  - `tests/matcher.test.mjs`
  - `tests/settings-store.test.mjs`
  - `tests/policy-engine.test.mjs`
  - `tests/settings-ui.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `tests/settings-runtime.test.mjs`
  - `README.md`
  - `docs/architecture.md`
  - `docs/plans/plan-26-per-site-policy-profiles.md`
  - `ROADMAP.md`
- Re-run `npm run test` to confirm baseline.

## Decisions
- Settings storage schema is now v2 with decode-time migration from v1.
- Profile precedence is fixed to exact > wildcard > longer target > earliest row.
- `excludeFromSuspend` is enforced via policy input `excludedHost` flag for matched profiles.
- Runtime keeps O(n) profile matching per tab with bounded profile count (`<= 200`).

## Retrospective
- What changed: host-specific overrides are now first-class settings with deterministic runtime behavior and options management.
- Risks left: with high profile counts, per-tab linear matching remains acceptable but may need indexing if future limits increase.
