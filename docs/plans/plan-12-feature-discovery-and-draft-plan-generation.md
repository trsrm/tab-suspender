# Plan 12 - Feature Discovery and Draft Plan Generation (No Code Changes)

## Status
Implemented

## Goal
Analyze current user-facing product behavior and generate separate, implementation-ready draft feature plans (Plan 25 through Plan 30) without changing runtime behavior.

## Scope
- Review current behavior, constraints, and known limitations in:
  - `README.md`
  - `docs/architecture.md`
  - existing plan docs under `docs/plans/`
- Produce six separate user-facing feature draft plans:
  - Plan 25: Scheduled snooze and quiet hours
  - Plan 26: Per-site policy profiles
  - Plan 27: Recovery center UX enhancements
  - Plan 28: Settings import/export
  - Plan 29: Manual suspend controls
  - Plan 30: Suspension reason transparency
- Update roadmap and plans index to track the new drafts.

## Out of Scope
- Any behavior change in `extension/src/`.
- Any test behavior change.
- Implementing any recommendation from Plans 25-30.
- Packaging/distribution workflow work reserved for Plan 16.

## Analysis Method
- Use current product constraints as guardrails:
  - privacy-first (no telemetry, no remote calls)
  - deterministic safety checks and URL validation
  - local storage versioning and bounded datasets
- Keep recommendations incremental, reversible, and testable with current local toolchain.
- Require each draft plan to include:
  - `Status`
  - `Goal`, `Scope`, `Non-goals`
  - `User value`
  - `Proposed UX/API/data model changes`
  - `Risks and failure modes`
  - `Implementation steps`
  - `Files expected to change`
  - `Test/evidence expectations`
  - `Exit criteria`
  - `Rollback`
  - `Dependencies/cross-plan references`
  - `Scoring` (`Impact`, `Effort`, `Confidence`, `Priority Score = (Impact * Confidence) - Effort`)

## Important Public API / Interface / Type Changes
- Plan 12 itself introduces no runtime/public API changes.
- Plan 25-30 drafts explicitly declare anticipated (future) interface deltas for:
  - `manifest.json` (commands/contextMenus where applicable)
  - storage schema envelopes/keys
  - options/suspended page UI contracts
  - shared TypeScript types

## Perspective Outputs
- `docs/plans/plan-25-scheduled-snooze-and-quiet-hours.md`
- `docs/plans/plan-26-per-site-policy-profiles.md`
- `docs/plans/plan-27-recovery-center-ux-enhancements.md`
- `docs/plans/plan-28-settings-import-export.md`
- `docs/plans/plan-29-manual-suspend-controls.md`
- `docs/plans/plan-30-suspension-reason-transparency.md`

## Files Added/Changed
- `docs/plans/plan-12-feature-discovery-and-draft-plan-generation.md`
- `docs/plans/plan-25-scheduled-snooze-and-quiet-hours.md`
- `docs/plans/plan-26-per-site-policy-profiles.md`
- `docs/plans/plan-27-recovery-center-ux-enhancements.md`
- `docs/plans/plan-28-settings-import-export.md`
- `docs/plans/plan-29-manual-suspend-controls.md`
- `docs/plans/plan-30-suspension-reason-transparency.md`
- `docs/plans/README.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run test`
  - Result: passed (full local suite, 0 failures).
- Manual checks:
  - `ROADMAP.md` marks Plan 12 implemented with details link.
  - `ROADMAP.md` includes draft entries for Plans 25-30 with links.
  - `docs/plans/README.md` lists Plan 12 and Plans 25-30 exactly once.
  - Each new draft includes scoring, explicit non-goals, exit criteria, and rollback.
  - No runtime/source files changed outside planning documentation.

## Exit Criteria
- Plan 12 is marked implemented in `ROADMAP.md` with details link.
- Six separate feature draft plans (25-30) exist with decision-complete sections.
- Validation checks pass unchanged.
- Runtime behavior remains unchanged.

## Rollback
- Revert Plan 12 documentation changes in:
  - `docs/plans/plan-12-feature-discovery-and-draft-plan-generation.md`
  - `docs/plans/plan-25-scheduled-snooze-and-quiet-hours.md`
  - `docs/plans/plan-26-per-site-policy-profiles.md`
  - `docs/plans/plan-27-recovery-center-ux-enhancements.md`
  - `docs/plans/plan-28-settings-import-export.md`
  - `docs/plans/plan-29-manual-suspend-controls.md`
  - `docs/plans/plan-30-suspension-reason-transparency.md`
  - `docs/plans/README.md`
  - `ROADMAP.md`
- Re-run `npm run typecheck` and `npm run test` to confirm baseline integrity.

## Decisions
- Plan 12 is constrained to user-facing feature discovery (not internal quality-refactor overlap with Plans 17-24).
- New feature draft IDs begin at Plan 25 to preserve top-level roadmap numbering consistency.
- Plan 16 (packaging/installability) remains separate and unchanged.

## Retrospective
- What changed: the roadmap now includes a concrete user-facing feature backlog with implementation-ready draft plans.
- Risks left: feature priorities are proposal-level and should be re-ranked after each draft transitions to implementation with measured outcomes.
