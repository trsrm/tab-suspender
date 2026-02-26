# Contributing

## Workflow principles
- Implement one plan at a time.
- Keep changes incremental and reversible.
- Do not mark a plan complete until exit criteria and required checks pass.
- Keep commits scoped to one plan ID whenever practical.

## Project tracking sources of truth
- `ROADMAP.md`:
  - high-level plan status board
  - global cross-plan decisions (`Decision Log`)
- `docs/plans/`:
  - detailed plan scope/steps
  - plan-specific decisions
  - test evidence
  - rollback notes
- `CHANGELOG.md`:
  - release-facing, user-visible changes by version

## Prerequisites
- macOS with Safari (required for manual smoke verification).
- Node.js and npm.
- Repository cloned locally.

## Contributor setup and checks
1. Install dependencies:
   - `npm ci`
2. Build extension artifacts:
   - `npm run build`
3. Sync Safari wrapper resources:
   - `npm run sync:safari-wrapper`
4. Type-check:
   - `npm run typecheck`
5. Run full test suite:
   - `npm run test`

Local Safari baseline:
1. Build and sync wrapper artifacts:
   - `npm run build:safari-wrapper`
2. Open `safari-wrapper/TabSuspenderWrapper.xcodeproj` in Xcode.
3. Run the `TabSuspenderHost` scheme once.
4. In Safari, open `Settings > Extensions` and enable **Tab Suspender**.
5. Execute applicable manual checks from `docs/qa-checklist.md`.

## Required checks by change type
- Minimum baseline for any plan:
  - `npm run typecheck`
- When touching runtime logic or tests:
  - run targeted impacted suites
- Before marking a plan implemented:
  - `npm run test`
- When changing extension runtime/assets used by wrapper:
  - `npm run build:safari-wrapper`

## Required evidence format
Record evidence in the active plan file under `docs/plans/` with:
- command run
- pass/fail result summary
- relevant counts (for example test totals)
- manual-check status (`pass`, `fail`, or `not-run` with reason)

## Release and versioning requirements
For any release/distribution:
1. Bump versions with:
   - `npm run release:version -- <x.y.z>`
2. Add a new top entry in `CHANGELOG.md` for that version and date with 3-6 user-visible changes.
3. Before finalizing artifacts, run:
   - `npm run test`
   - `npm run build:safari-wrapper`

Notes:
- Optional preview mode:
  - `npm run release:version -- <x.y.z> --dry-run`
- `release:version` updates required version fields (`package.json`, `extension/manifest.json`, Xcode project versions).

## Rollback expectations
- Revert only files touched by the current plan.
- Re-run `npm run test` after rollback to confirm baseline behavior.
- If rollback is applied, update plan/roadmap status accordingly.

## PR hygiene
- Keep scope limited to one plan ID whenever possible.
- Include a short summary of:
  - what changed
  - checks run
  - remaining risks
- Avoid unrelated refactors in the same change set.
