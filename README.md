# Tab Suspender (Safari)

Incremental Safari tab-suspender extension built with a roadmap-first process.

## Current Status
- Plan 0: Roadmap and governance defined.
- Plan 1: Scaffold and extension skeleton created.
- Suspension behavior is intentionally not implemented yet.

## Repository Layout
- `ROADMAP.md`: phased implementation plan and gates.
- `extension/`: Safari Web Extension files.
- `docs/`: architecture and QA documentation.
- `tests/`: lightweight scaffold tests.

## Local Development (Skeleton Stage)
1. Review `ROADMAP.md` and execute one plan at a time.
2. For the extension skeleton, use `extension/manifest.json` plus runtime stubs.
3. Generate Safari wrapper app via Xcode/Safari Web Extension converter in a later step when moving beyond scaffold verification.

## Scripts
- `npm run test`: run scaffold smoke tests.
- `npm run typecheck`: TypeScript type check (requires dependencies installed).

## Defaults Locked for v1
- macOS Safari target.
- No telemetry.
- Default timeout target: 60 minutes (implemented in later plans).
