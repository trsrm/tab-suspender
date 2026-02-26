# Plan 16 - Installable Safari Packaging Baseline (In-Repo Xcode Wrapper)

## Status
Implemented

## Goal
Provide a deterministic local-install path so contributors can install and enable the extension in Safari from a clean checkout without creating an ad hoc wrapper project.

## Scope
- Add a committed Xcode wrapper project for local Safari installation.
- Add a sync workflow that mirrors `build/extension` artifacts into wrapper extension resources.
- Document repeatable install and verification steps.
- Keep extension runtime behavior unchanged.

## Non-goals
- No App Store packaging.
- No signing/notarization automation.
- No runtime feature or policy changes.

## Implementation Steps
1. Added committed wrapper project scaffold in `safari-wrapper/` with:
   - host app target source + plist + entitlements.
   - Safari Web Extension target source + plist + entitlements.
   - shared Xcode scheme for `TabSuspenderHost`.
2. Added `scripts/sync-safari-wrapper.mjs` to:
   - verify `build/extension/manifest.json` exists and is valid JSON.
   - fail fast with actionable errors when build artifacts are missing/invalid.
   - replace wrapper resources with fresh synced `build/extension` output.
3. Added npm scripts:
   - `npm run sync:safari-wrapper`
   - `npm run build:safari-wrapper`
4. Updated contributor/runtime docs for wrapper-based local install flow.
5. Updated QA checklist with packaging-specific manual checks (`M-00`, `M-00b`, `M-00c`).
6. Updated roadmap status, decision log, and changelog for Plan 16 completion.

## Files Added/Changed
- `safari-wrapper/README.md`
- `safari-wrapper/TabSuspenderWrapper.xcodeproj/project.pbxproj`
- `safari-wrapper/TabSuspenderWrapper.xcodeproj/xcshareddata/xcschemes/TabSuspenderHost.xcscheme`
- `safari-wrapper/TabSuspenderHost/TabSuspenderHostApp.swift`
- `safari-wrapper/TabSuspenderHost/Info.plist`
- `safari-wrapper/TabSuspenderHost/TabSuspenderHost.entitlements`
- `safari-wrapper/TabSuspenderExtension/SafariWebExtensionHandler.swift`
- `safari-wrapper/TabSuspenderExtension/Info.plist`
- `safari-wrapper/TabSuspenderExtension/TabSuspenderExtension.entitlements`
- `safari-wrapper/TabSuspenderExtension/Resources/.gitignore`
- `safari-wrapper/TabSuspenderExtension/Resources/.gitkeep`
- `scripts/sync-safari-wrapper.mjs`
- `package.json`
- `README.md`
- `CONTRIBUTING.md`
- `docs/architecture.md`
- `docs/qa-checklist.md`
- `docs/plans/README.md`
- `docs/plans/plan-16-installable-safari-packaging-baseline.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run typecheck`
  - Result: pass (`tsc -p tsconfig.json --noEmit`).
- Command: `npm run test`
  - Result: pass (`81` tests, `81` pass, `0` fail).
- Command: `npm run build:safari-wrapper`
  - Result: pass (`build` + `sync:safari-wrapper` completed; manifest version `0.1.0` synced).
- Manual Safari/Xcode checks:
  - Result: not-run in this environment (active developer tools are Command Line Tools; full Xcode and Safari UI run path unavailable in non-interactive Codex session).
  - Required follow-up: execute `M-00..M-12` in `docs/qa-checklist.md` on a local interactive macOS session.

## Exit Criteria
- Committed wrapper project exists and is documented for local install.
- Sync workflow is deterministic and fails clearly on missing build prerequisites.
- Existing typecheck/test gates remain passing.
- Manual packaging/install checks are explicitly tracked (not implied).

## Rollback
- Revert only Plan 16 files listed above.
- Re-run `npm run test` to confirm baseline behavior.

## Decisions
- Keep wrapper resources generated from canonical `build/extension` output rather than editing wrapper resources directly.
- Keep Plan 16 focused on local install only; defer release signing/notarization automation.

## Retrospective
- What changed: local contributor install flow is now anchored on a committed wrapper project plus explicit sync commands.
- Risks left: wrapper build/launch still requires manual validation on a machine with full Xcode + Safari GUI access.
