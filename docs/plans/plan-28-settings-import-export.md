# Plan 28 - Settings Import/Export

## Status
Draft

## Goal
Provide local JSON export/import for user settings so configurations can be backed up and restored without cloud services.

## Scope
- Add options actions to export current configuration to a local JSON file.
- Add import flow with schema validation, preview/confirmation, and safe apply.
- Cover settings, exclusions, and selected recovery metadata according to explicit contract.

## Non-goals
- No cloud sync.
- No partial merge UI in initial version (replace or cancel only).
- No import of unsupported historical schemas without explicit migration rules.

## User Value
- Improves resilience when reinstalling or moving profiles.
- Enables power users to keep portable local backups.

## Proposed UX/API/Data Model Changes
- UX:
  - Add `Export Configuration` and `Import Configuration` controls in Options.
  - Show import summary (detected schema/version, record counts, validation result) before apply.
- API/runtime:
  - Reuse existing decode/sanitize pipelines for settings/recovery on import.
- Data model/storage (anticipated):
  - Define portable envelope schema, for example:
    - `exportSchemaVersion`
    - `settings`
    - `recoveryState` (bounded)
    - optional `generatedAtMinute`
- Types/interfaces (anticipated):
  - Add `PortableConfigV1` and import result discriminated union.
- Manifest (anticipated):
  - No new permissions required; use browser file APIs available to extension page.

## Risks and Failure Modes
- Invalid or hand-edited JSON can trigger inconsistent partial state if apply is not atomic.
- Importing very large files can impact options-page responsiveness.
- Schema drift between versions may confuse users if errors are not explicit.

## Implementation Steps
1. Define export schema and validation constraints.
2. Implement export serializer with deterministic field ordering.
3. Implement import parser, schema validation, and confirmation workflow.
4. Apply import atomically with rollback on write failure.
5. Add tests for valid import/export, invalid payloads, and failure resilience.

## Files Expected to Change
- `extension/src/options.ts`
- `extension/options.html`
- `extension/src/settings-store.ts`
- `extension/src/recovery-store.ts`
- `extension/src/types.ts`
- `tests/settings-ui.test.mjs`
- `tests/recovery-store.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/plan-28-settings-import-export.md`
- `ROADMAP.md`

## Test/Evidence Expectations
- `npm run build`
- `npm run typecheck`
- `node --test tests/settings-ui.test.mjs tests/recovery-store.test.mjs`
- `npm run test`
- Manual Safari check for local file picker/export download behavior.

## Exit Criteria
- Export produces a validated JSON envelope with documented schema.
- Import validates before apply and rejects malformed/unsupported payloads clearly.
- Existing settings/recovery flows remain stable post-import.

## Rollback
- Revert Plan 28 files and rerun full tests.

## Dependencies / Cross-Plan References
- Depends on existing versioned storage decode/sanitize conventions from Plans 6 and 14.
- Should align with Plan 26 if site profiles are added before this plan is implemented.

## Scoring
- Impact: 4
- Effort: 3
- Confidence: 4
- Priority Score: 13
