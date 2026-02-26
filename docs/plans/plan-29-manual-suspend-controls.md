# Plan 29 - Manual Suspend Controls

## Status
Draft

## Goal
Add explicit user-invoked suspend actions via keyboard shortcut and tab context menu while preserving existing safety guardrails.

## Scope
- Add keyboard command for suspending the active tab.
- Add context menu action for suspending selected/current tab.
- Route all manual actions through existing suspend flow with current safety checks.

## Non-goals
- No bypass of pinned/audible/internal/URL-safety guardrails.
- No multi-tab batch suspend in initial version.
- No redesign of existing toolbar action behavior.

## User Value
- Faster, more accessible manual control for keyboard-centric and context-menu workflows.
- Better discoverability of suspend action without opening Options.

## Proposed UX/API/Data Model Changes
- UX:
  - New keyboard shortcut entry in extension commands.
  - New right-click tab context menu item: `Suspend Tab`.
- API/runtime:
  - Extend background listener handling for `commands.onCommand` and `contextMenus.onClicked`.
  - Reuse current suspend candidate validation and action execution path.
- Data model/storage (anticipated):
  - No new persistent schema required.
- Types/interfaces (anticipated):
  - Optional action-source enum (`toolbar`, `command`, `contextMenu`) for logging/status branching.
- Manifest (anticipated):
  - Add `commands` section and `contextMenus` permission.

## Risks and Failure Modes
- New permission (`contextMenus`) may impact trust if not justified in docs.
- Source-specific branching can drift if manual paths are not unified.
- Shortcut conflicts with Safari/system defaults may reduce usability.

## Implementation Steps
1. Add manifest command/context menu declarations.
2. Register and handle command/context menu events in background runtime.
3. Reuse existing suspend pipeline to ensure guardrail parity.
4. Add tests for command/menu invocation and blocked/manual-result cases.
5. Update docs for permissions and usage.

## Files Expected to Change
- `extension/manifest.json`
- `extension/src/background.ts`
- `extension/src/types.ts` (optional source typing)
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/plan-29-manual-suspend-controls.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `npm run typecheck`
- `node --test tests/background-event-wiring.test.mjs tests/suspend-action.test.mjs`
- `npm run test`
- Manual Safari check for command binding and tab context menu visibility.

## Exit Criteria
- Keyboard shortcut and context menu action both trigger manual suspend.
- Manual paths preserve existing safety/eligibility protections.
- Permission and user-facing behavior are documented clearly.

## Rollback
- Revert Plan 29 files and rerun full tests.

## Dependencies / Cross-Plan References
- Builds on Plan 4 manual suspend foundation.
- Should coordinate with Plan 30 if action-result reason messaging is exposed.

## Scoring
- Impact: 4
- Effort: 2
- Confidence: 4
- Priority Score: 14
