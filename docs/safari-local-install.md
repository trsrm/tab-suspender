# Safari Local Install Guide (Xcode)

This is the simplest end-to-end path from a fresh machine to a working local install.

## 1) Install prerequisites
1. Install full **Xcode** from the Mac App Store (Command Line Tools only is not enough).
2. Launch Xcode once and finish first-run setup (license/components).
3. Verify Xcode is active:
   - `xcodebuild -version`
4. Install Node.js (LTS) and npm if not already installed.
5. Verify Node/npm:
   - `node -v`
   - `npm -v`

## 2) Get project ready
1. From repo root, install dependencies:
   - `npm ci`
2. Build extension runtime and sync wrapper resources:
   - `npm run build:safari-wrapper`

Expected result:
- `build/extension/manifest.json` exists.
- `safari-wrapper/TabSuspenderExtension/Resources/manifest.json` exists.

## 3) Open and run wrapper app in Xcode
1. Open:
   - `safari-wrapper/TabSuspenderWrapper.xcodeproj`
2. Select scheme:
   - `TabSuspenderHost`
3. Set destination:
   - `My Mac`
4. Click **Run** (or press `Cmd+R`).
5. In the host app window, click **Open Safari Extensions Settings**.

Expected result:
- Host app launches and Safari opens extension settings for this extension.

## 4) Enable extension in Safari
1. In Safari extension settings, find **Tab Suspender**.
2. Enable it.
3. If Safari prompts for site permissions, grant as needed for your local testing.

Expected result:
- Extension is enabled and visible in Safari extension settings.

## 5) Quick smoke check
1. Open extension Options from Safari extension settings.
2. Confirm settings page loads.
3. Open two normal HTTP(S) tabs.
4. Try toolbar action click on active tab and confirm it suspends.

## 6) Iteration workflow
After code changes, repeat:
1. `npm run build:safari-wrapper`
2. Re-run `TabSuspenderHost` in Xcode (`Cmd+R`).
3. Re-test in Safari.

## Troubleshooting
- `xcodebuild: requires Xcode`:
  - Install full Xcode and select it: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- Wrapper missing extension files:
  - Re-run `npm run build:safari-wrapper`
- Extension not shown in Safari:
  - Ensure host app was run successfully and **Open Safari Extensions Settings** was clicked.
- Extension appears but does not update after changes:
  - Re-run build/sync, run host app again, then disable/re-enable extension in Safari.
