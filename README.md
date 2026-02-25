# Tab Suspender (Safari)

A privacy-first Safari Web Extension that suspends idle tabs and restores them safely.

## Current Status
- Plan 0-10 are implemented.
- Local QA hardening is documented in `docs/qa-checklist.md` and `docs/plans/plan-8-qa-hardening.md`.
- v1 target remains macOS Safari with no telemetry.

## Implemented Behavior
- Background sweep evaluates tabs every minute and suspends eligible idle tabs.
- Toolbar action click can suspend the current tab immediately by bypassing only `active` + timeout checks.
- Policy safety guards skip active, pinned (optional), audible (optional), internal URLs, excluded hosts, and oversized URLs.
- Suspended-page payload includes original URL, title (trimmed/capped), and capture timestamp (minute precision).
- Suspended page uses previous tab title context, shows full original URL with click-to-copy feedback, and keeps URL display cropped to one line for readability.
- Restore flow validates URL safety (`http/https`, max 2048 chars) before navigation, and restore enablement remains validator-gated.
- Settings are versioned in `chrome.storage.local` under `settings` with runtime live updates via `storage.onChanged`.
- Host exclusions support exact hosts (`example.com`) and wildcard subdomain rules (`*.example.com`, subdomains only).

## Non-Goals and Limits (v1)
- No telemetry, analytics, or remote network calls.
- No automatic cloud sync; settings are local extension storage.
- No iOS/iPadOS support.
- No non-HTTP(S) restore targets.
- Wildcard exclusions do not match apex domains.

## Prerequisites
- macOS with Safari (for manual smoke checks).
- Node.js + npm.

## Local Development
1. Install dependencies:
   - `npm ci`
2. Build runtime output:
   - `npm run build`
3. Run type checks:
   - `npm run typecheck`
4. Run regression tests:
   - `npm run test`

## Loading the Extension Locally
- Runtime artifacts are generated into `build/extension/`.
- Import path: `build/extension/manifest.json`.
- `extension/` is source/static input only; do not load it directly.

## Contributing
- See `CONTRIBUTING.md` for plan-scoped workflow, required checks, evidence format, and rollback expectations.

## Manual Verification Workflow
Use `docs/qa-checklist.md` for the canonical release-readiness checklist. Core smoke coverage includes:
- Settings load/save behavior.
- Idle sweep suspension behavior.
- Action-click suspension safety behavior.
- Exact + wildcard exclusion behavior.
- Suspended-page restore safety behavior.

## Troubleshooting
- Build artifacts missing:
  - Run `npm run build` and verify `build/extension/manifest.json` exists.
- Settings appear stale:
  - Reopen options page and confirm `chrome.storage.local["settings"]` value shape (`schemaVersion: 1`).
- Tab did not suspend:
  - Check guard conditions: active, pinned/audible toggles, internal URL, excluded host, timeout, URL length.
- Restore button disabled:
  - Check suspended payload URL validity (`http/https`) and max URL length (2048).

## Repository Layout
- `ROADMAP.md`: high-level plan status + global cross-plan decisions.
- `docs/plans/`: detailed plan-by-plan implementation records and evidence.
- `docs/architecture.md`: runtime architecture and safety decisions.
- `docs/qa-checklist.md`: local release-readiness checklist.
- `extension/`: source TypeScript + static extension assets.
- `build/extension/`: compiled/importable extension runtime.
- `tests/`: Node test suites for policy, runtime, UI logic, and guardrails.

## Scripts
- `npm run build`: compile TypeScript and copy static extension assets.
- `npm run typecheck`: TypeScript typecheck without emit.
- `npm run test`: build + run all Node test suites (`tests/*.test.mjs`).
