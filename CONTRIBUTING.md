# Contributing

## Prerequisites
- macOS with Safari (required for manual smoke verification).
- Node.js and npm.
- Repository cloned locally.

## Local Setup
1. Install dependencies:
   - `npm ci`
2. Build extension artifacts:
   - `npm run build`
3. Sync Safari wrapper resources:
   - `npm run sync:safari-wrapper`
4. Type-check:
   - `npm run typecheck`
5. Run tests:
   - `npm run test`

## Local Safari Install Baseline
1. Build and sync wrapper artifacts:
   - `npm run build:safari-wrapper`
2. Open `safari-wrapper/TabSuspenderWrapper.xcodeproj` in Xcode.
3. Run the `TabSuspenderHost` scheme once.
4. In Safari, open `Settings > Extensions` and enable **Tab Suspender**.
5. Run applicable manual checks from `docs/qa-checklist.md`.

## Plan-Scoped Workflow
1. Implement one plan at a time.
2. Keep `ROADMAP.md` high-level (status board + global decisions only).
3. Store plan details in `docs/plans/`:
   - scope/steps
   - plan-specific decisions
   - test evidence
   - rollback notes
4. Do not mark a plan complete until its exit criteria and required checks pass.
5. Keep changes incremental and reversible.

## Required Checks
- Minimum baseline for any plan:
  - `npm run typecheck`
- When touching runtime logic or tests:
  - run targeted tests for impacted suites.
- Before marking a plan as implemented:
  - `npm run test`
- When changing extension assets/runtime used by Safari wrapper:
  - `npm run build:safari-wrapper`

## Evidence Format
Record evidence in the active plan file under `docs/plans/`:
- command run
- pass/fail result summary
- relevant counts (for example test totals)
- manual-check status (`pass`, `fail`, or `not-run` with reason)

## Rollback Expectations
- Revert only files touched by the current plan.
- Re-run `npm run test` after rollback to confirm baseline behavior.
- If rollback is applied, update plan/roadmap status accordingly.

## Documentation Update Rules
- Update `ROADMAP.md` for:
  - Plan Status Board entries
  - cross-plan/global Decision Log entries
  - high-level changelog notes
- Update `docs/plans/<plan-file>.md` for plan-local details:
  - implementation steps
  - evidence
  - rollback
  - plan-local decisions/retrospective

## PR Hygiene
- Keep scope limited to one plan ID whenever possible.
- Include a short summary of:
  - what changed
  - checks run
  - remaining risks
- Avoid unrelated refactors in the same change set.
