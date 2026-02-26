# Plan 11 - Multi-Lens Architecture Review and Follow-Up Draft Plans (No Code Changes)

## Status
Implemented

## Goal
Perform an analysis-only architecture review across eight explicit lenses and generate separate implementation-ready draft plans without changing runtime behavior.

## Scope
- Analyze current implementation and tests in:
  - `extension/src/`
  - `tests/`
  - `docs/architecture.md`
  - `README.md`
- Create separate draft plan files for:
  - KISS
  - YAGNI
  - DRY
  - performance
  - reliability
  - simplicity
  - over-engineering
  - other anti-patterns
- Update roadmap tracking and global decision log to standardize lens definitions and scoring.

## Out of Scope
- Any production behavior change under `extension/src/`.
- Any test behavior change.
- Implementing any recommendation from the generated drafts.

## Analysis Method
- Standard rubric used in every draft recommendation:
  - `Finding`
  - `Evidence`
  - `Risk if unchanged`
  - `Proposed change`
  - `Estimated impact`
  - `Complexity`
  - `Dependencies`
  - `Rollback`
- Standard scoring model used in every draft recommendation:
  - `Impact` (1-5)
  - `Effort` (1-5)
  - `Confidence` (1-5)
  - `Priority Score = (Impact * Confidence) - Effort`
- Recommendations are constrained to local, incremental, reversible changes that can be validated with the current local test strategy.

## Perspective Outputs
- `docs/plans/plan-17-kiss-simplification-opportunities.md`
- `docs/plans/plan-18-yagni-pruning-opportunities.md`
- `docs/plans/plan-19-dry-consolidation-opportunities.md`
- `docs/plans/plan-20-performance-opportunities.md`
- `docs/plans/plan-21-reliability-hardening-opportunities.md`
- `docs/plans/plan-22-simplicity-ux-and-maintenance.md`
- `docs/plans/plan-23-over-engineering-reduction.md`
- `docs/plans/plan-24-anti-patterns-and-code-health.md`

## Files Added/Changed
- `docs/plans/plan-11-analysis-and-plan-generation.md`
- `docs/plans/plan-17-kiss-simplification-opportunities.md`
- `docs/plans/plan-18-yagni-pruning-opportunities.md`
- `docs/plans/plan-19-dry-consolidation-opportunities.md`
- `docs/plans/plan-20-performance-opportunities.md`
- `docs/plans/plan-21-reliability-hardening-opportunities.md`
- `docs/plans/plan-22-simplicity-ux-and-maintenance.md`
- `docs/plans/plan-23-over-engineering-reduction.md`
- `docs/plans/plan-24-anti-patterns-and-code-health.md`
- `docs/plans/README.md`
- `ROADMAP.md`

## Test/Evidence
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run test`
  - Result: passed (81 tests, 0 failures).
- Manual checks:
  - All new draft plan files are linked from `docs/plans/README.md`.
  - `ROADMAP.md` status board links resolve.
  - Every draft uses the same rubric and scoring model.

## Exit Criteria
- Plan 11 is marked implemented in `ROADMAP.md` with details link.
- Eight separate draft plans (17-24) exist, one per perspective.
- Lens definitions and scoring model are standardized in roadmap decision log.
- Typecheck and full tests pass unchanged.

## Rollback
- Revert Plan 11 documentation changes in:
  - `docs/plans/plan-11-analysis-and-plan-generation.md`
  - `docs/plans/plan-17-kiss-simplification-opportunities.md`
  - `docs/plans/plan-18-yagni-pruning-opportunities.md`
  - `docs/plans/plan-19-dry-consolidation-opportunities.md`
  - `docs/plans/plan-20-performance-opportunities.md`
  - `docs/plans/plan-21-reliability-hardening-opportunities.md`
  - `docs/plans/plan-22-simplicity-ux-and-maintenance.md`
  - `docs/plans/plan-23-over-engineering-reduction.md`
  - `docs/plans/plan-24-anti-patterns-and-code-health.md`
  - `docs/plans/README.md`
  - `ROADMAP.md`
- Re-run `npm run typecheck` and `npm run test` to confirm baseline behavior.

## Decisions
- Plan 11 follow-up drafts are tracked as top-level roadmap plan IDs (`17-24`) instead of sub-plan suffixes.
- Draft recommendations must be de-duplicated across perspective files; when related work exists in another lens, the item includes explicit cross-reference.

## Retrospective
- What changed: project now has a standardized multi-lens quality review backlog with decision-complete, scoped draft plans and global scoring consistency.
- Risks left: recommendations are still unimplemented; ranking assumptions should be revisited after each draft plan is executed and measured.
