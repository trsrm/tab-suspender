# Plan 28 - Settings Import/Export

## Status
Implemented

## Goal
Provide local JSON export/import for user settings so configurations can be backed up and restored without cloud services.

## Scope
- Added options actions to export current configuration to a local JSON file.
- Added staged import flow with schema validation, preview, apply, and cancel.
- Covered settings and recovery metadata through a versioned portable envelope contract.

## Non-goals
- No cloud sync.
- No partial merge UI (replace/cancel only).
- No import of unsupported export schema versions.

## User Value
- Improves resilience when reinstalling or moving profiles.
- Enables local portable backups with explicit apply confirmation.

## Implementation Steps
1. Added portable schema/types and parser/serializer module:
   - New `PortableConfigV1` and import-result types in `types.ts`.
   - New `portable-config.ts` with `buildPortableConfig`, `serializePortableConfig`, and `parsePortableConfigJson`.
2. Added pure envelope builders in stores for sanitize-without-write reuse:
   - `createSettingsEnvelope` in `settings-store.ts`.
   - `createRecoveryEnvelope` in `recovery-store.ts`.
3. Extended options UI/logic:
   - Added Backup & Restore fieldset with Export/Import controls.
   - Added hidden file input and staged preview region.
   - Added dedicated import/export status channel.
   - Implemented export download as local JSON file.
   - Implemented import parse/validate -> preview -> atomic apply/cancel flow.
4. Implemented atomic import apply path:
   - Single `chrome.storage.local.set` call writing both `settings` and `recoveryState` keys.
5. Added tests and docs updates for the portable contract and options behavior.

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/portable-config.ts` (new)
- `extension/src/options.ts`
- `extension/options.html`
- `extension/src/settings-store.ts`
- `extension/src/recovery-store.ts`
- `tests/portable-config.test.mjs` (new)
- `tests/settings-ui.test.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/plans/plan-28-settings-import-export.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `npm run typecheck`
  - Result: passed.
- Command: `node --test tests/portable-config.test.mjs tests/settings-ui.test.mjs tests/recovery-store.test.mjs`
  - Result: passed.
- Command: `npm run test`
  - Result: passed.

## Exit Criteria
- Export produces a documented portable JSON envelope (`exportSchemaVersion: 1`).
- Import rejects malformed/unsupported payloads before writes.
- Valid import requires explicit apply and writes settings/recovery atomically.
- Existing settings/recovery flows remain stable after import.

## Rollback
- Revert Plan 28 files listed above.
- Re-run `npm run build` and `npm run test`.

## Dependencies / Cross-Plan References
- Reuses Plan 6 settings decode/sanitize/storage conventions.
- Reuses Plan 14 recovery sanitize/dedupe/storage conventions.
- Includes Plan 26 site profile settings in export/import payloads.

## Decisions
- Portable schema version starts at `exportSchemaVersion: 1`.
- Import mode is replace-only in v1 (no merge).
- Unknown top-level payload fields are ignored; unsupported schema version is rejected.
- Import/export does not include activity state.

## Retrospective
- What changed: local backup/restore capability now exists with staged validation UX and atomic apply semantics.
- Risks left: manual Safari file picker/download interaction remains validated via local manual checks only.
