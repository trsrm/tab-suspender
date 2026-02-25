# AGENTS

This repository uses incremental, plan-scoped delivery.

## Rules
- Implement one plan at a time.
- Use `ROADMAP.md` as a high-level status tracker + global cross-plan decisions.
- Store detailed plan specs, plan-specific decisions, test evidence, and rollbacks in `docs/plans/`.
- Do not batch multiple feature plans into a single implementation pass.
- Run relevant checks for each plan and record evidence in the plan file.
- Prefer simple, incremental changes, follow the Pareto principle, and avoid over-engineering.
