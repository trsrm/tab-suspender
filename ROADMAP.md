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
- [ ] Plan 17: (draft) KISS simplification opportunities ([details](docs/plans/plan-17-kiss-simplification-opportunities.md))
- [ ] Plan 18: (draft) YAGNI pruning opportunities ([details](docs/plans/plan-18-yagni-pruning-opportunities.md))
- [ ] Plan 19: (draft) DRY consolidation opportunities ([details](docs/plans/plan-19-dry-consolidation-opportunities.md))
- [ ] Plan 20: (draft) Performance opportunities ([details](docs/plans/plan-20-performance-opportunities.md))
- [ ] Plan 21: (draft) Reliability hardening opportunities ([details](docs/plans/plan-21-reliability-hardening-opportunities.md))
- [ ] Plan 22: (draft) Simplicity UX and maintenance opportunities ([details](docs/plans/plan-22-simplicity-ux-and-maintenance.md))
- [ ] Plan 23: (draft) Over-engineering reduction opportunities ([details](docs/plans/plan-23-over-engineering-reduction.md))
- [ ] Plan 24: (draft) Anti-pattern and code-health opportunities ([details](docs/plans/plan-24-anti-patterns-and-code-health.md))
- [ ] Plan 25: (draft) Scheduled snooze and quiet hours ([details](docs/plans/plan-25-scheduled-snooze-and-quiet-hours.md))
- [ ] Plan 26: (draft) Per-site policy profiles ([details](docs/plans/plan-26-per-site-policy-profiles.md))
- [ ] Plan 27: (draft) Recovery center UX enhancements ([details](docs/plans/plan-27-recovery-center-ux-enhancements.md))
- [ ] Plan 28: (draft) Settings import/export ([details](docs/plans/plan-28-settings-import-export.md))
- [ ] Plan 29: (draft) Manual suspend controls ([details](docs/plans/plan-29-manual-suspend-controls.md))
- [ ] Plan 30: (draft) Suspension reason transparency ([details](docs/plans/plan-30-suspension-reason-transparency.md))
- [ ] Plan 31: (draft) Disable/uninstall-safe suspended tab survival (prevent suspended tabs from closing when extension is disabled/uninstalled)

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
- 2026-02-26: Completed Plan 11 analysis-only multi-lens review and generated draft Plans 17-24 with standardized scoring/rubric metadata.
- 2026-02-26: Completed Plan 12 feature discovery analysis and generated draft Plans 25-30 for user-facing capability expansion without runtime changes.
