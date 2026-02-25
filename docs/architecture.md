# Architecture Notes (Current Runtime)

## Goal
Provide deterministic, safe tab suspension behavior for local Safari usage with minimal permissions and no telemetry.

## Runtime Components
- `extension/src/background.ts`
  - Owns activity tracking, settings hydration, alarm scheduling, sweep evaluation, and suspend navigation.
- `extension/src/policy.ts`
  - Pure policy evaluator with deterministic precedence and reason output.
- `extension/src/settings-store.ts`
  - Versioned settings decode/sanitize/load/save helpers for `chrome.storage.local`.
- `extension/src/matcher.ts`
  - Host exclusion normalization and exact/wildcard hostname matching.
- `extension/src/url-safety.ts`
  - Shared restore/suspend URL validator (`http/https`, max length 2048).
- `extension/src/options.ts`
  - Options page load/save flow, validation, and status messaging.
- `extension/src/suspended.ts`
  - Suspended page payload parsing, previous-title context rendering, URL copy feedback, and guarded restore action.
- `extension/src/types.ts`
  - Shared settings, activity, policy, and payload interfaces.

## Build and Packaging Flow
- Source lives in `extension/`.
- `npm run build` compiles TypeScript and copies static assets into `build/extension/`.
- Static icon assets under `extension/icons/` are copied into `build/extension/icons/` during build.
- Runtime JS in `build/extension/` is canonical for local import/testing.

## Data Flow
1. Extension startup
- `background.ts` schedules sweep alarm, hydrates settings and activity state from storage, prunes stale records, and seeds currently active tabs.
- Settings are hydrated from `chrome.storage.local["settings"]`.
- Activity state is hydrated from `chrome.storage.local["activityState"]`.
2. Activity capture
- `tabs.onActivated`, `tabs.onUpdated`, `windows.onFocusChanged`, `tabs.onRemoved`, and `tabs.onReplaced` maintain bounded minute-level tab activity state.
3. Sweep evaluation
- Alarm (`suspend-sweep-v1`) runs every minute.
- Alarm ticks are cadence-gated (`1..5` minute effective interval based on `idleMinutes`) before running full sweep logic.
- Sweep candidates are queried with pre-filters (`active: false` plus optional `pinned: false` / `audible: false`).
- If filtered query fails, runtime falls back to unfiltered tab query for safety.
4. Policy decision
- Evaluator returns deterministic `{ shouldSuspend, reason }`.
- Eligible tabs are rewritten to `suspended.html` with encoded payload.
5. Suspended page restore
- Suspended page validates payload URL before allowing restore.
- Invalid, unsupported, or oversized URLs remain blocked with explicit status text.

## Policy Precedence (Deterministic)
Order in `evaluateSuspendDecision`:
1. `active`
2. `pinned` (when `skipPinned` is true)
3. `audible` (when `skipAudible` is true)
4. `internalUrl` (non-http/https)
5. `urlTooLong`
6. `excludedHost`
7. `timeoutNotReached`
8. `eligible`

Timeout basis uses:
- `max(lastActiveAtMinute, lastUpdatedAtMinute)`, where focus switch events update the previous tab's `lastUpdatedAtMinute` as the start of unfocused idle time.

## Settings Model
- Storage key: `settings`.
- Envelope schema: `{ schemaVersion: 1, settings: { ... } }`.
- Sanitization:
  - `idleMinutes`: integer clamped to `1..1440`.
  - `skipPinned` / `skipAudible`: strict booleans.
  - `excludedHosts`: normalized/deduped, length and count bounded.
- Runtime applies `storage.onChanged` updates without restart.

## Activity State Model
- Storage key: `activityState`.
- Envelope schema: `{ schemaVersion: 1, activity: TabActivity[] }`.
- Activity records are sanitized, deduped by `tabId`, and bounded in count before persistence.
- Missing activity records are initialized conservatively at sweep time (`nowMinute`) so tabs become eligible only after one full timeout interval.

## Excluded Host Semantics
- Exact rule example: `example.com` matches only `example.com`.
- Wildcard rule example: `*.example.com` matches subdomains like `a.example.com` but not apex `example.com`.
- Invalid entries are ignored during normalization; valid entries still persist.

## URL Safety Rules
Shared validator in `url-safety.ts`:
- URL must exist and parse.
- Protocol must be `http:` or `https:`.
- URL length must be `<= 2048` characters.

Used by:
- Background suspend payload generation.
- Suspended-page restore action.

## Security Posture
- Manifest permissions limited to `tabs`, `storage`, `alarms`.
- CSP for extension pages: `script-src 'self'; object-src 'none';`.
- No remote script loading.
- No telemetry or network endpoints.

## Reliability and Failure Handling
- Background logs and continues when individual tab updates fail.
- Query/update wrappers support callback and Promise-style extension APIs.
- Suspend sweeps skip already-suspended extension pages to avoid self-churn.
- Invalid/missing activity defaults to non-suspension (`timeoutNotReached`).
- Invalid storage payload falls back to defaults.

## Accessibility Baseline
- Options and suspended pages use semantic structure and labeled controls.
- Error/status text uses `role="alert"` / `role="status"` + `aria-live` for assistive updates.
- Keyboard-operable controls are preserved.

## Known Limitations
- Local-only readiness process; no automated Safari UI integration tests.
- No telemetry means no in-product production diagnostics.
- No cross-device settings sync.
- No configurable policy precedence in v1.
