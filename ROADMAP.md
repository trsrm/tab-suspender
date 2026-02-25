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
- [ ] Storage schema versioning for future migration (Plan 6).
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
- [ ] Plan 6: Essential Settings UI and Persistence ([details](docs/plans/plan-6-settings-ui.md))
- [ ] Plan 7: Domain Exclusions With Wildcards ([details](docs/plans/plan-7-domain-exclusions.md))
- [ ] Plan 8: QA Hardening and Release Readiness (Local) ([details](docs/plans/plan-8-qa-hardening.md))

## Governance Rules
- Execute one plan per implementation turn.
- Do not mark a plan implemented until its exit criteria pass.
- Record global decisions in this file under `Decision Log`; keep plan-specific details in each plan file.
- Keep commits scoped to the current plan whenever possible.

## Quality Gates
- Gate A: Plan 0 governance and documentation model established.
- Gate B: Plan 1 scaffold exists with no suspension behavior yet.
- Gate C: Plans 2-7 each require test evidence before advancing.
- Gate D: Plan 8 requires full local regression checklist completion.

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

## Change Log
- 2026-02-25: Converted roadmap to high-level tracker; moved detailed plan history under `docs/plans/`.
- 2026-02-25: Moved global decision log into `ROADMAP.md` and removed separate decision-log file.
- 2026-02-25: Restored roadmap rules/hints sections; kept only plan implementation details in `docs/plans/`.
- 2026-02-25: Completed Plan 2 background event wiring with minute-level activity tracking and tests.
- 2026-02-25: Consolidated runtime build pipeline to a single output path (`build/extension`).
- 2026-02-25: Completed Plan 3 policy engine with deterministic decision matrix and unit tests.
- 2026-02-25: Completed Plan 4 suspend action flow with alarm-driven sweep, action-click suspend, payload encoding, and suspended-page decoding.
- 2026-02-25: Completed Plan 5 restore flow with shared URL validation (`http/https` + 2048-char max), safe suspended-page restore interaction, and oversized URL guardrails.
