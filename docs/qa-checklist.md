# QA Checklist (Plan 8 Local Readiness)

## Release Readiness Definition
A local-ready build requires:
- Automated gate commands passing (`typecheck` + full test suite).
- Core manual Safari smoke checklist executed with explicit `pass`/`fail` notes.
- Residual risks captured with concrete follow-up plan references if needed.

## Preconditions
- Dependencies installed (`npm ci`).
- Fresh build artifacts generated (`npm run build`).
- Extension loaded from `build/extension/manifest.json`.
- Test environment on macOS Safari for manual checks.

## Automated Regression Gate
| Check | Command | Expected |
| --- | --- | --- |
| TypeScript type safety | `npm run typecheck` | Exit code 0, no diagnostics |
| Full regression suite | `npm run test` | Exit code 0, all suites pass |

## Manual Safari Core Smoke Matrix
| ID | Scenario | Steps | Expected Result | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| M-01 | Options defaults load | Open options with empty storage | Idle `60`, `skipPinned=true`, `skipAudible=true`, empty exclusions | not-run | Requires interactive Safari session |
| M-02 | Persisted options load | Save settings, reopen options | Last saved values render correctly | not-run | Requires interactive Safari session |
| M-03 | Invalid exclusion warning | Save mixed valid/invalid excluded hosts | Save succeeds, invalid count warning shown | not-run | Requires interactive Safari session |
| M-04 | Idle sweep suspend | Leave non-active eligible tab idle past timeout | Tab navigates to `suspended.html` with payload | not-run | Requires interactive Safari session |
| M-05 | Action-click bypass behavior | Click toolbar action on active tab | Suspend occurs despite active/timeout, but safety guards remain | not-run | Requires interactive Safari session |
| M-06 | Exact exclusion block | Add exact host exclusion and trigger suspend path | Tab with exact host does not suspend | not-run | Requires interactive Safari session |
| M-07 | Wildcard exclusion semantics | Add `*.example.com`; test subdomain and apex | Subdomain blocked, apex unaffected | not-run | Requires interactive Safari session |
| M-08 | Restore valid URL | Open suspended page with valid payload and click restore | Navigation to original URL | not-run | Requires interactive Safari session |
| M-09 | Restore invalid/missing URL | Open suspended page with missing/invalid URL | Restore button disabled with clear status | not-run | Requires interactive Safari session |
| M-10 | Restore oversized URL | Open suspended page with >2048 char URL payload | Restore button disabled with oversized URL status | not-run | Requires interactive Safari session |

## Automated Evidence (2026-02-25)
- `npm run typecheck`
  - Result: pass (`tsc -p tsconfig.json --noEmit`).
- `npm run test`
  - Result: pass (`57` tests, `57` pass, `0` fail).

## Manual Evidence (2026-02-25)
- Result: blocked in this environment (non-interactive Codex run, Safari UI actions unavailable).
- Impact: automated coverage is strong, but interactive Safari behavior still requires operator confirmation.
- Required follow-up: run M-01..M-10 on a local Safari session and record pass/fail in this file before final distribution.

## Troubleshooting Matrix
| Symptom | Likely Cause | Verification | Action |
| --- | --- | --- | --- |
| Extension not loadable | Build artifacts missing/stale | Confirm `build/extension/manifest.json` exists | Run `npm run build` |
| Settings appear unsaved | Invalid form input or storage write issue | Check status text and storage envelope under `settings` | Correct input, save again, reload options |
| Tab not suspending | Guard condition prevents suspend | Check active/pinned/audible/internal/excluded/timeout/url length conditions | Adjust settings or test tab preconditions |
| Restore button disabled | URL failed validator | Check protocol + length + parseability in suspended payload | Use valid `http/https` URL <= 2048 chars |
| Sweep not firing | Alarm/service-worker lifecycle issue | Inspect extension logs for alarm registration/sweep activity | Reload extension and verify alarms/listeners |

## Exit Rule
Plan 8 local-readiness gate is complete only when:
- Automated gate is passing.
- Manual matrix M-01..M-10 has explicit `pass`/`fail` values.
- Any failures are tracked as follow-up plans.
