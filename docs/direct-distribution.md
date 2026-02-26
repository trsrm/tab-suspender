# Direct Distribution Guide (No Apple Developer Program)

This guide is for sharing the app directly with friends without App Store and without paid Apple signing/notarization.

## What this approach gives you
- You build once and send a file.
- Friends do **not** need Xcode.
- Friends may see macOS security warnings and need to allow the app manually.

## 1) Build a release app on your Mac
From the repository root:

```bash
npm ci
npm run release:version -- 0.1.1
npm run build:safari-wrapper
```

Notes:
- Replace `0.1.1` with the version you are releasing.
- Before packaging, add a new top entry in `CHANGELOG.md` (version, date, high-level changes).

Then in Xcode:
1. Open `safari-wrapper/TabSuspenderWrapper.xcodeproj`.
2. Select scheme: `TabSuspenderHost`.
3. Set configuration to `Release`:
   - Menu: `Product > Scheme > Edit Scheme...`
   - In `Run` action, set `Build Configuration` to `Release`.
   - In `Archive` action, confirm `Build Configuration` is `Release`.
4. Run once (`Cmd+R`) to ensure it builds.

## 2) Locate the built app
In Xcode:
1. Open `Product > Show Build Folder in Finder`.
2. Open the `Release` folder.
3. Confirm `TabSuspenderHost.app` exists.

## 3) Package it to send
In Terminal (example):

```bash
cd /path/to/Release
zip -r TabSuspenderHost-macos.zip TabSuspenderHost.app
```

Send `TabSuspenderHost-macos.zip` to your friend.

## 4) Friend install steps (no Xcode)
1. Unzip the file.
2. Move `TabSuspenderHost.app` to `/Applications`.
3. First launch with **Right-click > Open** (not double-click first time).
4. If macOS blocks it, go to:
   - `System Settings > Privacy & Security`
   - click **Open Anyway** for `TabSuspenderHost`
5. Launch the app.
6. In the app window, click **Open Safari Extensions Settings**.
7. In Safari, enable **Tab Suspender**.

## 5) If friend still cannot open the app
Run this command on your friend's Mac:

```bash
xattr -dr com.apple.quarantine /Applications/TabSuspenderHost.app
```

Then launch the app again and repeat Safari enablement.

## 6) Updating for new versions
Each time you release an update:
1. Bump release version and rebuild (`npm run release:version -- x.y.z` + `npm run build:safari-wrapper` + Xcode Release build).
2. Add release notes to `CHANGELOG.md` for that same version.
3. Re-zip updated `.app`.
4. Friend replaces old app in `/Applications`.
5. If Safari does not reflect update, disable/enable extension once.

## Known limitations
- This method is unsigned/unnotarized distribution.
- Some macOS setups may require extra confirmation steps.
- For smooth one-click install with fewer warnings, paid Developer ID signing + notarization is required.
