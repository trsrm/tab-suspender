# Changelog

All notable user-facing changes are documented in this file.

Current release: **1.4.0**

## [1.4.0] - 2026-02-26
- Added a new `Why tabs are not suspending` diagnostics panel in Options with manual refresh.
- Added local-only per-tab suspension diagnostics showing tab title, full URL, and deterministic suspend reason.
- Added reason summary counts across open tabs, including eligible tabs for transparency.
- Added bounded diagnostics rendering (`max 200` tab rows) to keep Options responsive on large tab sets.
- Added runtime diagnostics endpoint and regression coverage for diagnostics success, failure, empty, and truncated states.

## [1.3.0] - 2026-02-26
- Added local configuration export to JSON from Options for portable backups.
- Added staged configuration import flow with explicit preview, apply, and cancel controls.
- Added versioned portable schema (`exportSchemaVersion: 1`) with strict malformed/unsupported payload rejection.
- Added atomic import apply path that writes settings and recovery state together in one storage transaction.
- Expanded regression coverage for portable parser/serializer behavior and end-to-end options import/export UX.

## [1.2.0] - 2026-02-26
- Added per-site policy profiles so specific domains can override global suspend behavior.
- Added deterministic profile match precedence: exact host before wildcard, then longer host target, then earliest row.
- Added profile override controls in Settings for idle timeout, pinned/audible skip behavior, and per-site exclude-from-suspend.
- Upgraded settings storage to schema v2 with decode-time migration from existing schema v1 data.
- Expanded regression coverage for profile matching, schema migration/sanitization, options profile CRUD, and suspend runtime integration.

## [1.1.8] - 2026-02-26
- Hardened background listener payload handling with shared typed guards to reduce event-contract drift risk without changing suspend behavior.
- Centralized Options page status and validation copy into typed message maps while preserving exact user-visible text.
- Added dedicated settings/activity store invariant test suites for decode/sanitize boundary, dedupe, and cap behaviors.
- Expanded recovery-store test coverage for trim/cap invariants and kept storage schema compatibility unchanged.

## [1.1.7] - 2026-02-26
- Improved background runtime consistency by centralizing runtime state ownership, reducing edge-case drift during event-heavy tab/window activity.
- Simplified tab query/update compatibility handling with focused wrappers, preserving existing behavior while reducing maintenance risk.
- Kept suspend, restore, settings, and recovery flows behavior-compatible with no required user migration or settings reset.
- Expanded regression verification across background wiring, settings runtime, suspend action, and full suite coverage to confirm no behavior regressions.

## [1.1.6] - 2026-02-26
- Split Options page feedback into separate settings and recovery status channels so save/load messages do not overwrite reopen results.
- Added a dedicated recovery action live-status region for clearer reopen success/failure feedback.
- Centralized suspended-page restore/copy/unavailable text into grouped message maps with explicit invalid-URL reason mapping.
- Added regression coverage for status-channel isolation on recovery success and failure flows.

## [1.1.5] - 2026-02-26
- Improved startup reliability by making settings updates deterministic when storage hydration and live changes overlap.
- Added bounded retry/backoff for background activity and recovery persistence to recover from transient storage failures automatically.
- Hardened suspend sweep coordination to prevent stale pending catch-up work after failure paths.
- Expanded regression coverage for settings race ordering, persistence retry semantics, and sweep coordinator failure invariants.

## [1.1.4] - 2026-02-26
- Reduced suspend-path CPU overhead by consolidating URL validation/parsing into a single metadata-aware evaluation step.
- Optimized background activity persistence to avoid unnecessary pre-write sorting/allocation while preserving deterministic stored ordering.
- Improved Options recovery list responsiveness by reusing unchanged rows during rerenders instead of rebuilding the full list.
- Preserved existing suspend safety guards, action-click behavior, and storage schema compatibility with full regression coverage.

## [1.1.3] - 2026-02-26
- Removed legacy background PING message handling to reduce unsupported runtime API surface.
- Consolidated storage callback/promise compatibility handling into a shared adapter used by settings, activity, and recovery stores.
- Reduced background test-hook surface (`__testing`) to only active regression needs.
- Kept suspend, settings, and recovery behavior stable with full regression pass.

## [1.1.2] - 2026-02-26
- Refactored background runtime into focused internal modules while preserving runtime behavior.
- Split monolithic runtime responsibilities into `runtime-bootstrap`, `activity-runtime`, `persist-queue`, `sweep-coordinator`, and `suspend-runner`.
- Replaced duplicated activity/recovery persistence queue logic with a shared queued-persist helper.
- Added explicit sweep coordinator ownership for cadence gating and in-flight/pending sweep coalescing.

## [1.1.1] - 2026-02-26
- Switched suspended tabs to signed self-contained `data:` pages so suspended tabs survive extension disable/uninstall.
- Added legacy compatibility handling for existing `safari-extension://.../suspended.html?...` suspended tabs to avoid re-suspension churn.
- Updated data-page restore UX to work without JavaScript execution (static restore link + pre-rendered URL/status) for Safari reliability.
- Added regression coverage for data-page payload round-trip, suspended-page detection, and mixed legacy/data suspended tab skip behavior.

## [1.1.0] - 2026-02-26
- Migrated idle timeout UX from minutes to hours (`1..720`) while keeping minute-based storage compatibility.
- Raised default idle timeout to 24 hours and expanded maximum configurable timeout to 720 hours.
- Scaled suspend sweep cadence for long-idle profiles with a `1..30` minute effective interval to reduce CPU usage.
- Added/updated regression coverage for hours-based settings validation, long-idle cadence behavior, and compatibility paths.

## [1.0.0] - 2026-02-26
- Production-ready baseline for local Safari usage:
  - deterministic suspend/restore safety guards
  - settings + exclusions + recovery flows
  - reliability and CPU-reduction improvements
- Added roadmap-governed feature discovery drafts for next user-facing capabilities (Plans 25-30).

## [0.1.16] - 2026-02-26
- Added user-facing feature discovery draft plans (Plans 25-30).

## [0.1.15] - 2026-02-26
- Added multi-lens architecture analysis drafts (Plans 17-24).

## [0.1.14] - 2026-02-26
- Reduced Safari CPU usage with adaptive sweep cadence and filtered candidate queries.

## [0.1.13] - 2026-02-26
- Added reload-safe suspended-tab recovery ledger + options reopen flow.

## [0.1.12] - 2026-02-25
- Implemented reliable auto-suspend timeout based on focus transitions.

## [0.1.11] - 2026-02-25
- Improved suspended-page UX and icon coverage.

## [0.1.10] - 2026-02-25
- Technical debt cleanup and contributor workflow/docs improvements.

## [0.1.9] - 2026-02-25
- QA hardening and release-readiness checklist updates.

## [0.1.8] - 2026-02-25
- Added domain exclusions with exact + wildcard matching.

## [0.1.7] - 2026-02-25
- Added options/settings UI and persistence improvements.

## [0.1.6] - 2026-02-25
- Added restore flow with URL safety guards.

## [0.1.5] - 2026-02-25
- Added suspend action flow with alarm-driven sweep and payload encoding.

## [0.1.4] - 2026-02-25
- Added deterministic policy engine and unit tests.

## [0.1.3] - 2026-02-25
- Added background event wiring with minute-level activity tracking.

## [0.1.2] - 2026-02-25
- Added asset copy build step and updated npm build command.

## [0.1.1] - 2026-02-25
- Refactored project structure and TypeScript configuration.

## [0.1.0] - 2026-02-25
- Initial extension scaffold and project structure.
