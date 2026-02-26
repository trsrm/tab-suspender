# Safari Wrapper Project

This directory contains a committed minimal Xcode wrapper app used to install the Safari Web Extension locally.

## Workflow
1. Build extension artifacts and sync wrapper resources:
   - `npm run build:safari-wrapper`
2. Open `safari-wrapper/TabSuspenderWrapper.xcodeproj` in Xcode.
3. Select the `TabSuspenderHost` scheme and run the app once.
4. In the host app window, click **Open Safari Extensions Settings**.
5. In Safari, open **Settings > Extensions** and enable **Tab Suspender**.

## Notes
- `TabSuspenderExtension/Resources/` is generated from `build/extension/`.
- Re-run `npm run sync:safari-wrapper` whenever extension runtime files change.
- This plan targets local installation only; signing/notarization is intentionally out of scope.
- Full E2E setup instructions are in `docs/safari-local-install.md`.
