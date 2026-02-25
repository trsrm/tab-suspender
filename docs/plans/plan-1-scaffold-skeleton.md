# Plan 1 - Scaffold and Skeleton

## Status
Implemented

## Goal
Create project structure and a minimal Safari extension skeleton without suspension behavior.

## Scope
- Add extension/docs/tests folders.
- Add MV3 manifest baseline and runtime stubs.
- Add TypeScript skeleton and smoke tests.

## Implementation Steps
1. Create `extension/`, `docs/`, and `tests/` scaffolding.
2. Add baseline extension pages and script stubs.
3. Add TS sources and project config files.
4. Add scaffold smoke tests and documentation.

## Files Added/Changed
- `README.md`
- `docs/architecture.md`
- `docs/qa-checklist.md`
- `extension/manifest.json`
- `extension/background.js`
- `extension/options.html`
- `extension/options.js`
- `extension/suspended.html`
- `extension/suspended.js`
- `extension/src/background.ts`
- `extension/src/options.ts`
- `extension/src/suspended.ts`
- `extension/src/types.ts`
- `package.json`
- `tsconfig.json`
- `tests/scaffold.test.mjs`
- `.gitignore`

## Tests/Evidence
- Command: `node --test tests/scaffold.test.mjs`
- Result: 2 tests passed, 0 failed.

## Exit Criteria
- Required skeleton files exist.
- Extension behavior remains stub-only (no suspension logic).
- Baseline permissions and CSP are present.

## Rollback
- Revert scaffold files added in this plan.

## Decisions
- Keep logic unimplemented in Plan 1 to reduce one-shot failure risk.
- Keep permissions least-privilege (`tabs`, `storage`, `alarms`).

## Retrospective
- What changed: extension skeleton is in place and testable.
- Risks left: Safari load verification requires manual local developer setup.
