# Architecture Notes (Scaffold Stage)

## Goal
Provide a small, safe baseline for a Safari tab-suspender extension.

## Components
- `src/*.ts`: TypeScript source for extension runtime logic.
- `build/extension/background.js` / `build/extension/options.js` / `build/extension/suspended.js`: compiled runtime outputs generated from `src/*.ts` via `npm run build`.
- `suspended.html` + `suspended.js`: placeholder lightweight suspended-page UI.
- `options.html` + `options.js`: placeholder options UI.
- `src/types.ts`: planned interfaces for settings and suspension decisions.

## Safari Compatibility Notes
- Target model: Safari Web Extension with Apple wrapper workflow.
- Keep APIs limited to broadly supported extension primitives (`tabs`, `storage`, `alarms`).
- Avoid remote scripts and unsafe eval patterns.

## Security Posture (v1 baseline)
- Least-privilege permissions.
- Strict extension page CSP in manifest.
- No telemetry or remote endpoints.
- Explicit URL validation deferred to Plan 4/5.

## Performance Baseline
- Background runtime tracks tab/window activity in bounded in-memory state.
- Suspended/options pages are static and lightweight.

## Accessibility Baseline
- Semantic headings, labels, keyboard-reachable buttons.
- Minimal color contrast-safe styling.
