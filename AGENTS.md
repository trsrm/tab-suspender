# AGENTS

This repository uses incremental, plan-scoped delivery.

## Rules
- Implement one plan at a time.
- Use `ROADMAP.md` as a high-level status tracker + global cross-plan decisions.
- Store detailed plan specs, plan-specific decisions, test evidence, and rollbacks in `docs/plans/`.
- Do not batch multiple feature plans into a single implementation pass.
- Run relevant checks for each plan and record evidence in the plan file.
- Prefer simple, incremental changes, follow the Pareto principle, and avoid over-engineering.

## Release Versioning Rules
- For any release/distribution, run:
  - `npm run release:version -- <x.y.z>`
- Example:
  - `npm run release:version -- 0.1.1`
- Optional:
  - preview only: `npm run release:version -- 0.1.1 --dry-run`
- The script updates all required version fields (`package.json`, `extension/manifest.json`, Xcode `MARKETING_VERSION`, Xcode `CURRENT_PROJECT_VERSION`).
- If the script is skipped/fails, do the same updates manually before packaging.
- For every release, add a new top entry in `CHANGELOG.md` with:
  - version + date
  - 3-6 high-level user-visible changes
- Do not ship a release without a matching changelog entry.
- Before finalizing release artifacts, run:
  - `npm run test`
  - `npm run build:safari-wrapper`
