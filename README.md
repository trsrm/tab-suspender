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
2. Run `npm run build` to compile TypeScript and package runtime files into `build/extension/`.
3. Import the extension from `build/extension/manifest.json`.
4. Generate Safari wrapper app via Xcode/Safari Web Extension converter in a later step when moving beyond scaffold verification.

## Scripts
- `npm run build`: compile TypeScript and package importable extension files into `build/extension`.
- `npm run test`: run scaffold smoke tests.
- `npm run typecheck`: TypeScript type check (requires dependencies installed).

## Safari Import Path
- Use `build/extension/` (contains `manifest.json` and compiled runtime files).
- `extension/` is source and static assets; do not load it directly into Safari.

## Defaults Locked for v1
- macOS Safari target.
- No telemetry.
- Default timeout target: 60 minutes (implemented in later plans).
