# Plan 26 - Per-Site Policy Profiles

## Status
Draft

## Goal
Allow domain-scoped policy overrides so users can tune suspend behavior for specific sites without changing global defaults.

## Scope
- Introduce per-site profiles with deterministic precedence over global settings for matching hosts.
- Support exact-host and wildcard-subdomain host targets, aligned with existing exclusion semantics.
- Include profile create/edit/delete UI in Options.

## Non-goals
- No regex host matching.
- No remote profile sync.
- No removal of existing global exclusions.

## User Value
- Lets users keep default suspend behavior while protecting critical workflows on specific domains.
- Reduces friction from one-size-fits-all timeout and pin/audible behavior.

## Proposed UX/API/Data Model Changes
- UX:
  - Add `Site Profiles` section in Options with host matcher, override controls, and conflict status.
- API/runtime:
  - Add resolved effective-settings computation per tab URL before policy evaluation.
- Data model/storage (anticipated):
  - New versioned `siteProfiles` envelope:
    - `profiles: SiteProfile[]`
    - each profile contains normalized host rule and optional overrides (`idleMinutes`, `skipPinned`, `skipAudible`, `excludeFromSuspend`).
- Types/interfaces (anticipated):
  - Add `SiteProfile`, `ResolvedPolicySettings`, and profile-matching helpers.
- Manifest (anticipated):
  - No new permissions required.

## Risks and Failure Modes
- Conflicting profiles may produce non-obvious outcomes.
- Profile matching order ambiguity can create regression risk.
- Large profile lists can increase sweep-time matching cost.

## Implementation Steps
1. Define profile schema and deterministic conflict resolution order.
2. Implement normalization/validation and storage sanitation.
3. Add options UI for profile management with clear precedence messaging.
4. Integrate effective-settings resolution into background policy path.
5. Add tests for match precedence, override application, and invalid profile handling.

## Files Expected to Change
- `extension/src/types.ts`
- `extension/src/matcher.ts`
- `extension/src/policy.ts`
- `extension/src/background.ts`
- `extension/src/options.ts`
- `extension/options.html`
- `tests/matcher.test.mjs`
- `tests/policy-engine.test.mjs`
- `tests/settings-ui.test.mjs`
- `tests/suspend-action.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/plan-26-per-site-policy-profiles.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `npm run typecheck`
- `node --test tests/matcher.test.mjs tests/policy-engine.test.mjs tests/settings-ui.test.mjs tests/suspend-action.test.mjs`
- `npm run test`

## Exit Criteria
- Per-site profile CRUD is available in Options.
- Effective policy resolution is deterministic and tested for conflicts.
- Existing global settings still function when no profile matches.

## Rollback
- Revert only Plan 26 files and rerun full tests.

## Dependencies / Cross-Plan References
- Shares host normalization rules with Plan 7 domain exclusions.
- Should coordinate with Plan 30 to expose profile-derived skip reasons.

## Scoring
- Impact: 5
- Effort: 4
- Confidence: 4
- Priority Score: 16
