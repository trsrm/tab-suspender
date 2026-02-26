# Changelog

All notable user-facing changes are documented in this file.

Current release: **1.1.0**

## [1.1.0] - 2026-02-26
- Plan 32: migrated idle timeout UX from minutes to hours (`1..720`) while keeping minute-based storage compatibility.
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
