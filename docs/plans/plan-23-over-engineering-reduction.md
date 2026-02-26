# Plan 23 - Over-Engineering Reduction

## Status
Implemented

## Goal
Reduce avoidable internal complexity in background runtime orchestration while preserving suspend/restore behavior, storage schema, and user-visible UX.

## Scope
- Centralize mutable background runtime state in one explicit typed envelope.
- Replace generic tab API compatibility helper with narrow `queryTabs(...)` and `updateTab(...)` wrappers.
- Keep `__testing` behavior stable while formalizing its shape with a named type.

## Non-goals
- No policy or suspend-decision behavior changes.
- No settings/activity/recovery schema or key changes.
- No options or suspended page UX changes.
- No broad runtime module redesign beyond `background.ts` ownership simplification.

## Implementation Steps
1. Added `BackgroundRuntimeState` and `createInitialRuntimeState()` in `extension/src/background.ts`.
2. Routed mutable runtime values through `runtimeState`:
   - `recoveryEntries`
   - `focusedWindowId`
   - `currentSettings`
   - `settingsTransitionEpoch`
   - `runtimeReady`
3. Removed generic `invokeChromeApiWithCompatibility(...)` and introduced focused wrappers:
   - `queryTabs(...)`
   - `updateTab(...)`
4. Added explicit `BackgroundTestingApi` type and exported `__testing` using that contract, preserving existing methods and semantics.

## Files Added/Changed
- `extension/src/background.ts`
- `docs/plans/plan-23-over-engineering-reduction.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `node --test tests/background-event-wiring.test.mjs tests/settings-runtime.test.mjs tests/suspend-action.test.mjs`
  - Result: passed (38 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (94 tests, 0 failures).

## Exit Criteria
- Background mutable runtime state is centralized in a typed state envelope.
- Over-generic tab API wrapper abstraction is removed in favor of narrow wrappers with identical compatibility behavior.
- Existing `__testing` hooks remain behavior-compatible and are now type-constrained.
- Targeted and full regression suites pass.

## Rollback
- Revert Plan 23 files:
  - `extension/src/background.ts`
  - `docs/plans/plan-23-over-engineering-reduction.md`
  - `ROADMAP.md`
- Re-run:
  - `npm run build`
  - `npm run test`

## Decisions
- Keep runtime orchestration behavior unchanged and confine Plan 23 changes to maintainability-focused internal structure.
- Preserve callback/promise compatibility semantics in tab API wrappers while removing generic abstraction overhead.
- Treat `__testing` as an explicit contract to avoid accidental surface growth.

## Retrospective
- What changed: `background.ts` now has clearer state ownership and less abstraction indirection, which reduces cognitive load during debugging.
- Risks left: event-driven MV3 runtime behavior still requires broad regression coverage on future runtime edits.
