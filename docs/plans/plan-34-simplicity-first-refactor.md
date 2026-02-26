# Plan 34 - Simplicity-First Refactor (UI + Runtime Wrappers)

## Status
Implemented

## Goal
Reduce maintenance overhead by decomposing the options page runtime, removing low-value options-page indirection, and consolidating duplicated browser API compatibility wrappers, while preserving policy/runtime behavior and storage contracts.

## Scope
- Split the monolithic options runtime into focused modules.
- Introduce a shared browser API compatibility layer for tabs/runtime message calls.
- Remove options-page `WeakMap` state indirection and keyed recovery-row diffing.
- Preserve callback/promise compatibility behavior and existing user-facing flows.

## Non-goals
- No policy-evaluator behavior changes.
- No settings/activity/recovery schema changes.
- No manifest permission changes.
- No deep background listener architecture redesign.

## Implementation Steps
1. Added shared browser API compatibility helper module:
   - `extension/src/browser-compat.ts`
   - `queryTabsWithCompat(...)`
   - `updateTabWithCompat(...)`
   - `createTabWithCompat(...)`
   - `sendRuntimeMessageWithCompat(...)`
2. Rewired `extension/src/background.ts` to consume shared tab wrappers and removed duplicated local callback/promise wrappers.
3. Decomposed options runtime into focused modules under `extension/src/options/`:
   - `dom.ts`
   - `messages.ts`
   - `idle-hours.ts`
   - `site-profiles.ts`
   - `settings.ts`
   - `recovery.ts`
   - `diagnostics.ts`
   - `portable-config.ts`
4. Reduced `extension/src/options.ts` to composition root + event wiring (`104` LOC after refactor).
5. Simplified recovery rendering by removing keyed row reuse/diff logic and always rerendering the bounded list.
6. Replaced module-internal `WeakMap` state usage with explicit module-local state (`stagedImport`, `siteProfileRows`).
7. Added direct compatibility tests for the new browser adapter and updated options tests to reflect simplified recovery rerender behavior.

## Complexity Checkpoints
- `extension/src/options.ts`:
  - Before: `1135` LOC
  - After: `104` LOC
- Duplicated compatibility wrapper markers (`let settled = false`) across `extension/src`:
  - Before: `6`
  - After: `3`

## Files Added/Changed
- `extension/src/browser-compat.ts` (new)
- `extension/src/background.ts`
- `extension/src/options.ts`
- `extension/src/options/dom.ts` (new)
- `extension/src/options/messages.ts` (new)
- `extension/src/options/idle-hours.ts` (new)
- `extension/src/options/site-profiles.ts` (new)
- `extension/src/options/settings.ts` (new)
- `extension/src/options/recovery.ts` (new)
- `extension/src/options/diagnostics.ts` (new)
- `extension/src/options/portable-config.ts` (new)
- `tests/browser-compat.test.mjs` (new)
- `tests/settings-ui.test.mjs`
- `docs/architecture.md`
- `docs/plans/README.md`
- `docs/plans/plan-34-simplicity-first-refactor.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `node --test tests/browser-compat.test.mjs tests/settings-ui.test.mjs tests/background-event-wiring.test.mjs tests/suspend-action.test.mjs tests/settings-runtime.test.mjs`
  - Result: passed (71 tests, 0 failures).
- Command: `npm run typecheck`
  - Result: passed.
- Command: `npm run test`
  - Result: passed (138 tests, 0 failures).

## Exit Criteria
- Options runtime is split into focused modules with `options.ts` as composition entrypoint.
- Background and options no longer own duplicate non-storage callback/promise wrappers.
- Recovery list rendering no longer uses keyed row-diff optimization.
- Existing runtime/policy behavior and storage contracts remain unchanged.
- Targeted and full regression suites pass.

## Rollback
- Revert Plan 34 files listed above.
- Re-run:
  - `npm run build`
  - `npm run test`

## Decisions
- Keep callback+promise compatibility support, but centralize it in one browser adapter.
- Prefer simpler bounded-list rerendering over keyed recovery-row DOM reuse complexity.
- Keep options diagnostics/status semantics stable while clearing stale diagnostics summary/list on refresh failure.

## Retrospective
- What changed: options responsibilities are now module-scoped and easier to navigate; browser API compatibility behavior is centralized; low-value options rendering/state indirection was removed.
- Risks left: browser-compat wrappers remain a critical shared adapter and should stay covered by targeted tests when API handling changes.
