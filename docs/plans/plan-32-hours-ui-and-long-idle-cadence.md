# Plan 32 - Long-Idle Hours UX + Aggressive Sweep Scaling (CPU-First)

## Status
Implemented

## Goal
Shift user-facing idle timeout configuration to hours for long-idle usage patterns while preserving minute-based storage compatibility and reducing background CPU load with longer sweep cadence at high idle settings.

## Scope
- Keep persisted settings schema/version unchanged (`schemaVersion: 1`, `settings.idleMinutes` remains canonical).
- Expose idle timeout in options UI as hours (`1..720`).
- Set default idle timeout to 24 hours.
- Scale sweep cadence from idle configuration with `1..30` minute effective intervals.

## Implementation Steps
1. Updated settings constants/defaults in `settings-store.ts`:
   - Added `MIN_IDLE_HOURS = 1`, `MAX_IDLE_HOURS = 720`.
   - Derived minute bounds from hours (`60..43200`).
   - Set default `idleMinutes` to `24 * 60`.
2. Updated options UI and runtime options logic:
   - Renamed options input to hours (`idleHours` / `idleHoursError`).
   - Rendered stored `idleMinutes` as integer hours (`floor(idleMinutes / 60)`).
   - Parsed/validated hours in `1..720`.
   - Saved as minute values (`idleMinutes = idleHours * 60`) to preserve storage compatibility.
3. Updated background sweep cadence formula:
   - Changed to `interval = floor(idleMinutes / 120)`.
   - Clamped interval to `1..30` minutes.
4. Updated tests for new defaults/ranges and cadence timing semantics.
5. Updated architecture/roadmap/plans index docs to reflect Plan 32 decisions and behavior.

## Files Added/Changed
- `extension/src/settings-store.ts`
- `extension/options.html`
- `extension/src/options.ts`
- `extension/src/background.ts`
- `tests/settings-ui.test.mjs`
- `tests/settings-runtime.test.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `tests/scaffold.test.mjs`
- `docs/architecture.md`
- `docs/plans/README.md`
- `ROADMAP.md`
- `docs/plans/plan-32-hours-ui-and-long-idle-cadence.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `npm run test`
  - Result: passed (81 tests, 0 failures).
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).

## Exit Criteria
- Options UI accepts hours (`1..720`) and displays hour values.
- Stored settings remain minute-based and schema-compatible.
- Default timeout is 24 hours.
- Sweep cadence scales up to 30-minute intervals for long idle settings.
- Full automated test suite passes.

## Rollback
- Revert Plan 32 changes in:
  - `extension/src/settings-store.ts`
  - `extension/options.html`
  - `extension/src/options.ts`
  - `extension/src/background.ts`
  - `tests/settings-ui.test.mjs`
  - `tests/settings-runtime.test.mjs`
  - `tests/background-event-wiring.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `tests/scaffold.test.mjs`
  - `docs/architecture.md`
  - `docs/plans/README.md`
  - `ROADMAP.md`
  - `docs/plans/plan-32-hours-ui-and-long-idle-cadence.md`
- Rebuild outputs with `npm run build`.

## Decisions
- UI unit conversion is hours-only; storage remains minute-canonical to avoid schema migration risk.
- Minimum timeout increased to 1 hour through derived minute clamp (`60`).
- Default timeout changed from 60 minutes to 24 hours.
- CPU-first cadence scaling uses 2-hour buckets up to a 30-minute max sweep interval.

## Retrospective
- What changed: timeout UX now aligns with long-idle workflows and background sweep work is reduced for high idle settings.
- Risks left: users needing sub-hour timeout granularity lose that option by design.
