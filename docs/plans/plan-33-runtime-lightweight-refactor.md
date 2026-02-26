# Plan 33 - CPU-First Lightweight Runtime Refactor (Memory + Stability)

## Status
Implemented

## Goal
Reduce steady-state background CPU/allocation overhead, shrink suspended-page data URL footprint, and improve sweep-runtime resilience while preserving suspend policy semantics, storage contracts, and permissions.

## Scope
- Preserve policy reason ordering/semantics and manual action-click behavior.
- Precompile host exclusion/site profile matching structures for sweep/action/diagnostics hot paths.
- Add bounded adaptive sweep backoff (`+0..+5` minutes) driven by sweep run stats.
- Simplify generated suspended `data:` page markup/CSS while keeping restore safety and key context.
- Switch suspended data URL detection in sweep skip path to marker-based matching (no payload decode required).

## Non-goals
- No storage schema/key/version changes.
- No manifest permission changes.
- No new user-facing settings controls.
- No policy precedence redesign.

## Implementation Steps
1. Added shared internal performance/stability types in `types.ts`:
   - `CompiledPolicyContext` and related compiled matcher types.
   - `SweepRunStats` for sweep telemetry between runner and background cadence logic.
2. Refactored `matcher.ts` to support compiled matching:
   - Added `compileExcludedHostRules(...)` and `matchesExcludedHostInCompiledRules(...)`.
   - Added `compileSiteProfileRules(...)` and `findMatchingSiteProfileInCompiledRules(...)`.
   - Added `compilePolicyContext(settings)` to precompute both indices once per settings transition.
   - Preserved existing public matcher behavior by routing legacy helpers through compiled logic.
3. Updated `suspend-runner.ts` hot path:
   - Injected compiled policy context provider.
   - Removed redundant `new URL(...)` reparse in suspend evaluation by reusing URL metadata hostname.
   - Replaced sweep suspended-page skip decode path with marker/legacy checks.
   - Added sweep stats return path (`evaluatedTabs`, `suspendedTabs`, `failedUpdates`, `durationMs`).
4. Updated `background.ts` cadence control:
   - Added runtime fields for compiled policy context and adaptive `sweepBackoffMinutes`.
   - Recompiled policy context on settings transition commit.
   - Added heavy/light sweep thresholds and bounded backoff update rules.
   - Applied effective interval as `min(30, baseInterval + backoff)` with backoff bounded to `0..5`.
   - Exposed read-only backoff/stats accessors in `__testing` for deterministic tests.
5. Updated `suspended-payload.ts`:
   - Added decode-size guard (`MAX_DECODED_SUSPENDED_DATA_URL_LENGTH = 32768`).
   - Simplified generated suspended page HTML/CSS to reduce payload length.
   - Added deterministic encoded marker token and switched `isSuspendedDataUrl(...)` to marker/signature detection without payload decode.
6. Extended regression coverage:
   - Added compiled matcher parity tests.
   - Added adaptive sweep backoff increase/decrease tests.
   - Added suspended payload size guardrail assertion.
7. Updated architecture and plan index docs.

## Files Added/Changed
- `extension/src/types.ts`
- `extension/src/matcher.ts`
- `extension/src/background/suspend-runner.ts`
- `extension/src/background.ts`
- `extension/src/suspended-payload.ts`
- `tests/matcher.test.mjs`
- `tests/background-event-wiring.test.mjs`
- `tests/suspend-action.test.mjs`
- `docs/architecture.md`
- `docs/plans/README.md`
- `docs/plans/plan-33-runtime-lightweight-refactor.md`
- `ROADMAP.md`

## Tests/Evidence
- Command: `npm run build`
  - Result: passed.
- Command: `node --test tests/matcher.test.mjs tests/suspend-action.test.mjs tests/background-event-wiring.test.mjs`
  - Result: passed (51 tests, 0 failures).
- Command: `npm run test`
  - Result: passed (131 tests, 0 failures).
- Command: `npm run typecheck`
  - Result: passed (`tsc -p tsconfig.json --noEmit`).

## Exit Criteria
- Compiled host/profile matching is used in suspend evaluation hot paths.
- No duplicate hostname parse occurs after URL metadata validation in suspend-runner.
- Adaptive sweep backoff increases/decreases deterministically and is bounded to `+5` minutes.
- Generated suspended data page payload remains self-contained and below the new regression threshold in tests.
- Marker-based suspended data URL detection avoids payload decode in sweep skip path.
- Full regression suite passes.

## Rollback
- Revert Plan 33 files:
  - `extension/src/types.ts`
  - `extension/src/matcher.ts`
  - `extension/src/background/suspend-runner.ts`
  - `extension/src/background.ts`
  - `extension/src/suspended-payload.ts`
  - `tests/matcher.test.mjs`
  - `tests/background-event-wiring.test.mjs`
  - `tests/suspend-action.test.mjs`
  - `docs/architecture.md`
  - `docs/plans/README.md`
  - `docs/plans/plan-33-runtime-lightweight-refactor.md`
  - `ROADMAP.md`
- Re-run:
  - `npm run build`
  - `npm run test`

## Decisions
- Keep behavior compatibility for policy outcomes and storage schema, while permitting bounded auto-suspend cadence delay under heavy sweep load.
- Keep existing `findMatchingSiteProfile(...)` and `matchesExcludedHost(...)` APIs for parity while routing runtime hot paths through compiled equivalents.
- Use marker/signature string matching for suspended data URL detection in sweep skip path; retain decode helpers for compatibility/testing.
- Cap adaptive backoff at `5` minutes and retain existing `30`-minute global max interval cap.

## Retrospective
- What changed: sweep and diagnostics now reuse compiled matcher state and avoid redundant parsing; cadence adapts to heavy/light workloads; suspended-page data URL footprint is lower.
- Risks left: CPU improvement is structurally validated through deterministic tests; real-world Safari profiling under large tab sets is still recommended for empirical confirmation.
