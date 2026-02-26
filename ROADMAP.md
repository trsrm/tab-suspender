# Tab Suspender Roadmap

## Purpose
This file stays intentionally high level. It tracks what is implemented vs not implemented.
Detailed plan scope, decisions, tests, and historical notes are stored in `docs/plans/`.

## Engineering Principles
- Build in small, reversible increments.
- Prefer explicit safety checks over implicit behavior.
- Keep permissions, runtime cost, and storage footprint minimal.
- Make all decisions testable with deterministic acceptance criteria.
- Preserve user trust: no telemetry in v1, no hidden network behavior.

## Safari Extension Best Practices Checklist
- [x] Least-privilege permissions only (`tabs`, `storage`, `alarms`) in initial scaffold.
- [x] Strict extension-page CSP and no remote-code loading.
- [x] Default-safe policy target: skip pinned, audible, and internal pages.
- [x] Explicit URL validation before suspend/restore (Plan 4/5).
- [x] Graceful failure handling and non-breaking fallback behavior (Plan 4/5).
- [x] Storage schema versioning for future migration (Plan 6).
- [x] Safari Web Extension lifecycle compatibility notes in architecture docs.
- [x] Lightweight suspended page goal with bounded background work.
- [x] Accessibility baseline for options/suspended pages.

## Agentic Development Workflow
- Execute one mini-plan per implementation turn.
- Do not start a new plan until the current plan passes all exit criteria.
- Require Definition of Ready (DoR) before coding a plan.
- Require Definition of Done (DoD) with measurable outcomes.
- Capture test evidence for every plan.
- Include rollback instructions for every plan.
- Record changed assumptions in the `Decision Log`.
- Keep commits scoped to one plan ID whenever possible.
- Add a short retrospective for each implemented plan (`what changed`, `risks left`).

### Definition of Ready (Hints)
- Objective is clear and bounded.
- Target files/components are identified.
- Validation method is defined.
- Risks and rollback path are known.

### Definition of Done (Hints)
- Implementation matches plan scope exactly.
- Required checks/tests pass.
- Docs and assumptions are updated.
- Exit criteria and evidence are recorded.

### Evidence and Rollback Hints
- Evidence should include commands run, result summary, and manual checks.
- Rollback should revert only files touched by the current plan.

## Plan Status Board
- [x] Plan 0: Roadmap and Governance ([details](docs/plans/plan-0-roadmap-governance.md))
- [x] Plan 1: Scaffold and Skeleton ([details](docs/plans/plan-1-scaffold-skeleton.md))
- [x] Plan 2: Background Event Wiring ([details](docs/plans/plan-2-background-event-wiring.md))
- [x] Plan 3: Policy Engine + Unit Tests ([details](docs/plans/plan-3-policy-engine.md))
- [x] Plan 4: Suspend Action + Lightweight Suspended Screen ([details](docs/plans/plan-4-suspend-action.md))
- [x] Plan 5: Restore Flow + URL Safety Guards ([details](docs/plans/plan-5-restore-flow.md))
- [x] Plan 6: Essential Settings UI and Persistence ([details](docs/plans/plan-6-settings-ui.md))
- [x] Plan 7: Domain Exclusions With Wildcards ([details](docs/plans/plan-7-domain-exclusions.md))
- [x] Plan 8: QA Hardening and Release Readiness (Local) ([details](docs/plans/plan-8-qa-hardening.md))
- [x] Plan 9: Technical debt and contributor docs (CONTRIBUTING, code comments, cleanup) ([details](docs/plans/plan-9-technical-debt-contributor-docs.md))
- [x] Plan 10: Suspended page UX polish + extension icon coverage ([details](docs/plans/plan-10-suspended-page-ux-polish-and-extension-icon.md))
- [x] Plan 11: Multi-lens architecture review + follow-up draft plan generation (analysis-only, no code changes) ([details](docs/plans/plan-11-analysis-and-plan-generation.md))
- [x] Plan 12: Feature discovery and draft plan generation for user-facing capabilities (analysis-only, no code changes) ([details](docs/plans/plan-12-feature-discovery-and-draft-plan-generation.md))
- [x] Plan 13: Reliable auto-suspend timeout (focus-based + restart-safe) ([details](docs/plans/plan-13-reliable-auto-suspend-timeout.md))
- [x] Plan 14: Reload-safe recovery ledger + options reopen flow ([details](docs/plans/plan-14-reload-safe-recovery.md))
- [x] Plan 15: Safari CPU reduction via adaptive sweep cadence + candidate filtering ([details](docs/plans/plan-15-safari-cpu-reduction.md))
- [x] Plan 16: Installable Safari packaging baseline (in-repo Xcode wrapper + sync workflow) ([details](docs/plans/plan-16-installable-safari-packaging-baseline.md))
- [x] Plan 17: KISS refactor of background runtime (modularization + shared persist queue + sweep coordinator) ([details](docs/plans/plan-17-kiss-simplification-opportunities.md))
- [x] Plan 18: YAGNI pruning opportunities (runtime surface + shared storage compatibility adapter) ([details](docs/plans/plan-18-yagni-pruning-opportunities.md))
- [x] Plan 19: DRY consolidation opportunities ([details](docs/plans/plan-19-dry-consolidation-opportunities.md))
- [x] Plan 20: Performance opportunities ([details](docs/plans/plan-20-performance-opportunities.md))
- [x] Plan 21: Reliability hardening opportunities ([details](docs/plans/plan-21-reliability-hardening-opportunities.md))
- [x] Plan 22: Simplicity UX and maintenance opportunities ([details](docs/plans/plan-22-simplicity-ux-and-maintenance.md))
- [x] Plan 23: Over-engineering reduction opportunities ([details](docs/plans/plan-23-over-engineering-reduction.md))
- [x] Plan 24: Anti-pattern and code-health opportunities ([details](docs/plans/plan-24-anti-patterns-and-code-health.md))
- [x] Plan 26: Per-site policy profiles ([details](docs/plans/plan-26-per-site-policy-profiles.md))
- [x] Plan 28: Settings import/export ([details](docs/plans/plan-28-settings-import-export.md))
- [x] Plan 30: Suspension reason transparency ([details](docs/plans/plan-30-suspension-reason-transparency.md))
- [x] Plan 31: Disable/uninstall-safe suspended tab survival (prevent suspended tabs from closing when extension is disabled/uninstalled) ([details](docs/plans/plan-31-disable-uninstall-safe-suspended-tab-survival.md))
- [x] Plan 32: Long-idle hours UX + aggressive sweep scaling (CPU-first) ([details](docs/plans/plan-32-hours-ui-and-long-idle-cadence.md))
- [x] Plan 33: CPU-first lightweight runtime refactor (compiled matcher paths + adaptive sweep backoff + lighter suspended data URLs) ([details](docs/plans/plan-33-runtime-lightweight-refactor.md))
- [x] Plan 34: Simplicity-first refactor (options modularization + shared browser compatibility wrappers) ([details](docs/plans/plan-34-simplicity-first-refactor.md))

## Governance Rules
- Execute one plan per implementation turn.
- Do not mark a plan implemented until its exit criteria pass.
- Record global decisions in this file under `Decision Log`; keep plan-specific details in each plan file.
- Keep commits scoped to the current plan whenever possible.

## Quality Gates
- Gate A: Plan 0 governance and documentation model established.
- Gate B: Plan 1 scaffold exists with no suspension behavior yet.
- Gate C: Plans 2-7 each require test evidence before advancing.
- Gate D: Plan 8 requires full local regression checklist execution with explicit automated + manual status capture.

## Decision Log
### 2026-02-25
- **D-001**: Project target is macOS Safari only for v1.
  - Alternatives: iOS/iPadOS support from day one.
  - Impact: lower implementation and validation complexity.
- **D-002**: Packaging path is Safari Web Extension with Apple wrapper workflow.
  - Alternatives: legacy Safari App Extension.
  - Impact: aligns with modern extension model.
- **D-003**: Telemetry is disabled in v1.
  - Alternatives: local-only metrics, opt-in remote telemetry.
  - Impact: stronger privacy baseline.
- **D-004**: Default policy direction is balanced with 60-minute idle timeout target.
  - Alternatives: aggressive (30m), conservative (120m).
  - Impact: balanced UX and memory savings.
- **D-005**: `ROADMAP.md` is high-level only; detailed historical planning lives in `docs/plans/`.
  - Alternatives: keep everything in a single roadmap file.
  - Impact: clearer tracking and better auditability.
- **D-006**: Global decision history is maintained in `ROADMAP.md` (not a separate file).
  - Alternatives: dedicated `docs/plans/decision-log.md`.
  - Impact: single source of truth for cross-plan decisions.
- **D-007**: Activity timestamps use minute precision (`epoch-minute` integers) with explicit `*AtMinute` naming.
  - Alternatives: millisecond timestamps or ISO minute strings.
  - Impact: clearer semantics and stable comparisons for timeout policy logic.
- **D-008**: Runtime JavaScript output is canonicalized to `build/extension`; `extension/` is source and static assets only.
  - Alternatives: maintain duplicate runtime JS in both `extension/` and `build/extension`.
  - Impact: single compilation target and reduced drift risk.
- **D-009**: Policy evaluator precedence is fixed and deterministic, with idle timeout based on `max(lastActiveAtMinute, lastUpdatedAtMinute)`.
  - Alternatives: configurable or multi-reason precedence, activity-source-specific idle semantics.
  - Impact: predictable behavior and stable policy assertions across Plans 3-7.
- **D-010**: Toolbar action click suspend bypasses only `active` and timeout checks, while preserving pinned/audible/internal safety guards.
  - Alternatives: strict full-policy click behavior, or force-suspend bypassing all guards.
  - Impact: immediate manual suspend UX without weakening core safety protections.
- **D-011**: Restore/suspend URL safety is centralized with a shared validator and fixed 2048-character max restorable URL length.
  - Alternatives: separate validator logic per page, higher/lower max length threshold, or protocol-permissive restore.
  - Impact: deterministic guardrails, consistent behavior across suspend and restore flows, and simpler test coverage.
- **D-012**: Settings persistence is versioned in `chrome.storage.local` using a single envelope key (`settings`) with live background updates via `storage.onChanged`.
  - Alternatives: unversioned flat keys, startup-only settings load, or split keys per field.
  - Impact: migration-ready storage shape, centralized validation/sanitization, and deterministic runtime settings behavior without restart.
- **D-013**: Domain exclusions support exact host and subdomain-only wildcard (`*.example.com`) rules, with invalid entries dropped while valid entries are still persisted.
  - Alternatives: apex-inclusive wildcard semantics, strict save-blocking on any invalid entry, or exact-only matching.
  - Impact: deterministic host exclusion behavior with low-friction settings UX and strong policy-level safety.
- **D-014**: Plan 8 QA gate evidence is tracked in both `docs/qa-checklist.md` and the Plan 8 file, with manual Safari steps explicitly marked when blocked (never implied as passed).
  - Alternatives: automated-only release gate, or undocumented manual checks.
  - Impact: auditable readiness reporting with clear residual-risk visibility.
- **D-015**: Suspended page UX now prioritizes full original URL visibility/copyability and previous page title context, while keeping restore eligibility strictly tied to URL safety validation.
  - Alternatives: host-only summary text, static suspended-page document title, and no explicit copy interaction.
  - Impact: better restore context and usability without weakening Plan 5 safety guardrails.
- **D-016**: Auto-suspend idle timing is based on unfocused duration, backed by persisted activity state so eligibility survives service-worker restarts.
  - Alternatives: continue memory-only activity tracking and generic tab-update-driven timeout resets.
  - Impact: predictable timeout behavior that aligns with user focus changes and remains reliable across MV3 lifecycle restarts.
### 2026-02-26
- **D-017**: Suspended-tab recovery fallback is persisted as a bounded, deduped URL ledger and exposed via Options-only manual reopen controls.
  - Alternatives: automatic startup reopen, toolbar-only recovery action, or no recovery fallback.
  - Impact: users can recover dropped suspended tabs after extension reloads without introducing automatic side effects.
- **D-018**: Suspend sweep execution remains on a 1-minute alarm tick, but full sweep work is cadence-gated (`1..5` minutes) and candidate-filtered to reduce Safari CPU load under high tab counts.
  - Alternatives: fixed 1-minute full sweeps, coarser alarm period changes, or user-configurable sweep interval.
  - Impact: materially lower background runtime churn while preserving existing suspend safety guards and action-click behavior.
- **D-019**: Post-Plan-11 quality drafts use fixed lens definitions and a shared scoring rubric (`Impact`, `Effort`, `Confidence`, `Priority Score = (Impact * Confidence) - Effort`) for cross-plan ranking consistency.
  - Alternatives: ad hoc per-plan scoring, or no shared numeric prioritization.
  - Impact: comparable prioritization across KISS/YAGNI/DRY/performance/reliability/simplicity/over-engineering/anti-patterns drafts and clearer sequencing decisions.
- **D-020**: Plan 12 feature discovery is scoped to user-facing capabilities, and generated draft feature plans use top-level roadmap IDs starting at 25.
  - Alternatives: fold user-facing work into existing quality-lens drafts, or use nested `12.x` identifiers.
  - Impact: clearer separation between feature growth and internal quality tracks with consistent roadmap indexing.
- **D-021**: Local install packaging is standardized on a committed in-repo Xcode wrapper project hydrated by synced `build/extension` artifacts.
  - Alternatives: docs-only manual setup, or generating wrapper project ad hoc per developer.
  - Impact: deterministic contributor installation path with reduced setup drift and reproducible Safari enablement workflow.
- **D-022**: Idle timeout is now configured in hours in the options UI (`1..720`), while storage/runtime remain minute-canonical for compatibility; default timeout is 24 hours and sweep cadence scales up to a 30-minute max interval for long-idle profiles.
  - Alternatives: keep minute-based UI/range, introduce schema migration to `idleHours`, or retain 5-minute max sweep cadence.
  - Impact: better alignment with long-idle usage patterns and lower background CPU on high-idle configurations without breaking existing stored settings format.
- **D-023**: Suspended tabs now navigate to a signed self-contained `data:text/html` document, while legacy `safari-extension://.../suspended.html?...` payload tabs remain backward-compatible.
  - Alternatives: keep extension-page suspension only, or support user-selectable dual-format suspension.
  - Impact: suspended tabs survive extension disable/uninstall without changing URL safety guardrails or recovery storage schema.
- **D-024**: Background runtime internals are modularized into dedicated components (`runtime-bootstrap`, `activity-runtime`, `persist-queue`, `sweep-coordinator`, `suspend-runner`) with `background.ts` as composition root and no behavior-contract changes.
  - Alternatives: keep single-file runtime orchestration, or perform behavior-changing refactor alongside module split.
  - Impact: lower coupling and clearer ownership boundaries for future maintenance while preserving existing suspend and persistence semantics.
- **D-025**: Legacy background PING runtime messaging was removed, storage callback/promise compatibility wrappers were centralized in `storage-compat.ts`, and `background.ts` test hooks were reduced to active usage only.
  - Alternatives: keep legacy PING surface and per-store wrapper duplication.
  - Impact: smaller runtime API surface, lower maintenance fan-out for storage compatibility fixes, and clearer production-vs-test boundaries.
- **D-026**: Captured-at UTC minute formatting is centralized in `time-format.ts`, and suspended-title max length is canonicalized in `suspended-payload.ts` and reused by recovery sanitization, with string/limit parity preserved.
  - Alternatives: continue module-local duplicates in options/suspended/payload/recovery paths.
  - Impact: lower maintenance fan-out and reduced drift risk with no behavior-contract changes.
- **D-027**: Plan 20 performance pass centralizes suspend URL analysis into a single metadata-aware validation step, routes internal/excluded/too-long policy checks through precomputed flags, and moves activity persistence to an unsorted write path while preserving deterministic storage ordering in `activity-store`.
  - Alternatives: keep repeated URL parsing and pre-sort/clone persistence snapshots.
  - Impact: lower steady-state background CPU/allocation overhead without behavior or schema changes.
- **D-028**: Reliability hardening adds monotonic settings transition ordering, bounded persistence retry/backoff (`2` retries starting at `50ms`), and defensive sweep pending-state reset on failure/new independent runs.
  - Alternatives: rely on current best-effort ordering with single-attempt persistence and implicit coordinator state assumptions.
  - Impact: improved determinism across startup/update races and storage/scheduler failure paths without changing policy semantics or storage schema.
- **D-029**: Options UI status messaging is now split into separate settings and recovery channels, while suspended-page copy/status strings are centralized in grouped message maps with explicit invalid-reason mapping.
  - Alternatives: keep a single shared options status region and scattered suspended-page constants.
  - Impact: lower UI-state coupling and reduced message-drift risk with no behavior, policy, or storage-contract changes.
- **D-030**: Background runtime mutable state is now centralized in a typed `runtimeState` envelope, and generic tab API compatibility indirection is replaced by focused `queryTabs`/`updateTab` wrappers.
  - Alternatives: retain scattered module-level globals and a shared generic invocation helper.
  - Impact: lower orchestration complexity and clearer ownership boundaries in `background.ts` without changing runtime behavior or storage contracts.
- **D-031**: Background event payload validation now uses shared typed guards (`types.ts`), options-page status/copy ownership is centralized in a typed map, and storage sanitize/decode invariants are locked by dedicated module-level tests.
  - Alternatives: keep local ad hoc payload typing and rely on indirect integration coverage only.
  - Impact: lower contract drift risk and clearer maintainability boundaries without user-visible behavior changes.
- **D-032**: Settings storage schema is upgraded to v2 with decode-time migration from v1 to support per-site policy profiles, and per-site match precedence is fixed to exact > wildcard, then longer host target, then earliest row.
  - Alternatives: keep schema v1 with parallel profile key storage, or use list-order-first precedence.
  - Impact: deterministic host-specific policy overrides without breaking existing persisted settings.
- **D-033**: Options now supports local configuration export/import via a versioned portable JSON envelope (`exportSchemaVersion: 1`) with staged preview/confirm and atomic dual-key (`settings` + `recoveryState`) apply.
  - Alternatives: immediate import apply without preview, or separate per-key writes.
  - Impact: user-controlled backup/restore with safer validation UX and no partial-write drift across settings/recovery state.
- **D-034**: Suspension diagnostics are exposed as a manual, local-only options-page snapshot over runtime messaging, reusing existing policy reason taxonomy with bounded per-tab output (`max 200`) and full reason-count summaries.
  - Alternatives: continuous auto-refresh diagnostics, telemetry-backed diagnostics, or unbounded per-tab rendering.
  - Impact: transparent troubleshooting for suspend eligibility without changing policy behavior, storage schema, or runtime sweep cadence.
- **D-035**: Policy host/profile matching now uses settings-transition-compiled matcher indices, sweep cadence adds bounded adaptive backoff (`+0..+5` minutes) from sweep run stats, and suspended data URL skip detection is marker-based while preserving legacy signature compatibility.
  - Alternatives: continue per-tab rule scans and fixed cadence, or decode full data-url payloads in sweep skip path.
  - Impact: lower steady-state background CPU/allocation churn and smaller suspended-page footprint without policy/schema/permission changes.
- **D-036**: Browser tabs/runtime callback+promise compatibility handling is centralized in `browser-compat.ts`, and options-page state/rendering dropped keyed recovery-row reuse and `WeakMap` indirection in favor of explicit bounded rerender/state flow.
  - Alternatives: keep per-module compatibility wrappers and keyed recovery DOM diffing.
  - Impact: lower code duplication and reduced cognitive overhead with no policy/schema/permission behavior changes.

## Change Log
- 2026-02-25: Converted roadmap to high-level tracker; moved detailed plan history under `docs/plans/`.
- 2026-02-25: Moved global decision log into `ROADMAP.md` and removed separate decision-log file.
- 2026-02-25: Restored roadmap rules/hints sections; kept only plan implementation details in `docs/plans/`.
- 2026-02-25: Completed Plan 2 background event wiring with minute-level activity tracking and tests.
- 2026-02-25: Consolidated runtime build pipeline to a single output path (`build/extension`).
- 2026-02-25: Completed Plan 3 policy engine with deterministic decision matrix and unit tests.
- 2026-02-25: Completed Plan 4 suspend action flow with alarm-driven sweep, action-click suspend, payload encoding, and suspended-page decoding.
- 2026-02-25: Completed Plan 5 restore flow with shared URL validation (`http/https` + 2048-char max), safe suspended-page restore interaction, and oversized URL guardrails.
- 2026-02-25: Completed Plan 6 settings UI and persistence with schema-versioned local storage, explicit Save flow, and live runtime settings hydration/update handling.
- 2026-02-25: Completed Plan 7 domain exclusions with exact/wildcard host matching, options-side invalid-entry handling, and runtime policy integration for sweep/action-click safety.
- 2026-02-25: Completed Plan 8 QA hardening with updated docs, deterministic local regression checklist, and recorded release-readiness evidence/residual risks.
- 2026-02-25: Completed Plan 9 technical debt cleanup with contributor documentation, centralized background callback/Promise compatibility handling, and shared background test harness utilities.
- 2026-02-25: Completed Plan 10 suspended-page UX polish with title/document-title improvements, URL copy interaction, stronger restore CTA styling, and extension icon wiring.
- 2026-02-25: Completed Plan 13 reliable auto-suspend timeout with focus-based idle semantics, persisted activity hydration/persistence, and restart-durability coverage.
- 2026-02-26: Completed Plan 14 reload-safe recovery with versioned suspended-tab recovery storage, options-based reopen UI, and regression coverage for recovery persistence/failure handling.
- 2026-02-26: Completed Plan 15 Safari CPU reduction with adaptive sweep cadence gating, filtered sweep candidate queries with fallback, and suspended-page self-churn avoidance.
- 2026-02-26: Completed Plan 16 installable Safari packaging baseline with committed Xcode wrapper scaffolding and build-to-wrapper resource sync workflow.
- 2026-02-26: Completed Plan 17 KISS runtime refactor with modular background internals, shared persist queue helper, and sweep coordinator extraction without behavior-contract changes.
- 2026-02-26: Completed Plan 11 analysis-only multi-lens review and generated draft Plans 17-24 with standardized scoring/rubric metadata.
- 2026-02-26: Completed Plan 12 feature discovery analysis and generated draft Plans 26-30 for user-facing capability expansion without runtime changes.
- 2026-02-26: Completed Plan 32 long-idle hours UX with minute-compatible storage, 24-hour default timeout, and 30-minute max sweep cadence scaling.
- 2026-02-26: Completed Plan 33 CPU-first lightweight runtime refactor with compiled matcher policy context, bounded adaptive sweep backoff (`+0..+5`), and reduced suspended data URL payload size.
- 2026-02-26: Completed Plan 31 disable/uninstall-safe suspended-tab survival with signed self-contained `data:` suspended pages and legacy extension-page compatibility detection.
- 2026-02-26: Completed Plan 18 YAGNI pruning by removing legacy PING messaging, consolidating storage compatibility wrappers into `storage-compat.ts`, and minimizing background `__testing` surface.
- 2026-02-26: Completed Plan 28 settings import/export with portable JSON schema v1, staged import preview/apply/cancel UX, atomic settings+recovery writes, and targeted parser/UI regression coverage.
- 2026-02-26: Completed Plan 30 suspension reason transparency with manual options diagnostics refresh, local runtime snapshot messaging, deterministic reason summaries, and bounded per-tab diagnostics rendering.
- 2026-02-26: Completed Plan 19 DRY consolidation by centralizing captured-time formatting and suspended-title truncation constants with parity tests.
- 2026-02-26: Completed Plan 20 performance opportunities by removing repeated suspend-path URL parsing, optimizing activity persistence snapshots, and adding keyed recovery-list rerender reconciliation.
- 2026-02-26: Completed Plan 21 reliability hardening with settings transition epoch guards, bounded persistence retries/backoff, and sweep failure-path invariant coverage.
- 2026-02-26: Completed Plan 22 simplicity UX/maintenance pass by splitting options settings vs recovery status channels, centralizing suspended-page message maps, and adding status-isolation regression coverage.
- 2026-02-26: Completed Plan 23 over-engineering reduction by centralizing background runtime state in a typed envelope, replacing generic tab API indirection with focused wrappers, and formalizing the `__testing` contract.
- 2026-02-26: Completed Plan 24 anti-pattern/code-health hardening with shared background payload guards, typed options message maps, and dedicated settings/activity/recovery store invariant tests.
- 2026-02-26: Completed Plan 26 per-site policy profiles with schema v2 migration, deterministic host-profile precedence, runtime effective-settings resolution, options profile CRUD, and regression coverage.
- 2026-02-26: Completed Plan 34 simplicity-first refactor with options runtime modularization, shared tabs/runtime compatibility wrappers, and simplified recovery rerender/state handling.
