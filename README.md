# Tab Suspender (Safari)

A privacy-first Safari Web Extension that automatically suspends idle tabs and helps you restore them safely.

## What it is
Tab Suspender reduces tab clutter and resource usage by replacing long-idle tabs with a lightweight suspended page. Suspended tabs are encoded as self-contained `data:` pages so they remain restorable even if the extension is disabled or uninstalled. It keeps behavior predictable and local-only, with no telemetry or remote services.

## Key features
- Automatic idle tab suspension based on your configured timeout.
- Manual suspend for the current tab from the toolbar action.
- Safety guards that skip active, internal, and other protected tabs.
- Per-site exclusions with exact host and wildcard subdomain support.
- Safe restore flow with URL validation before navigation.
- Recently suspended recovery list in Options for one-click reopen.
- Legacy suspended extension-page URLs remain compatible while the extension is enabled.

## Who it is for
- macOS Safari users who keep many tabs open and want less memory/CPU pressure.
- Users who want a local-first extension with no telemetry.

Current platform scope:
- macOS Safari only.
- No iOS/iPadOS support.

## Quick start (Xcode local install)
1. Install dependencies:
   - `npm ci`
2. Build extension assets and sync the Safari wrapper:
   - `npm run build:safari-wrapper`
3. Open `safari-wrapper/TabSuspenderWrapper.xcodeproj` in Xcode.
4. Run the `TabSuspenderHost` scheme once.
5. In Safari, open `Settings > Extensions` and enable **Tab Suspender**.

For full setup and troubleshooting steps, see [Safari Local Install Guide](docs/safari-local-install.md).

## How to use
1. Open extension options from Safari extension settings.
2. Set your idle timeout and optional rules (for example pinned/audible behavior).
3. Add excluded hosts as needed (`example.com` or `*.example.com`).
4. Use the toolbar action when you want to suspend the current tab immediately.
5. On a suspended tab, use **Restore** to return to the original page (URL safety checks apply).
6. If tabs disappear after extension reload/update, reopen from **Recently Suspended Tabs** in Options.

## Troubleshooting
- Extension files not showing in wrapper:
  - Run `npm run build:safari-wrapper` and verify `safari-wrapper/TabSuspenderExtension/Resources/manifest.json` exists.
- Settings seem stale:
  - Reopen Options and save again to refresh local settings state.
- Tab did not suspend:
  - Check active/internal/excluded status and timeout window (sweep is minute-based).
- Restore is unavailable:
  - The suspended URL failed restore safety checks (`http/https`, max length).

## Documentation map
User docs:
- [Changelog](CHANGELOG.md)
- [Safari Local Install Guide](docs/safari-local-install.md)
- [Direct Distribution Guide](docs/direct-distribution.md)

Contributor docs:
- [Contributing](CONTRIBUTING.md)
- [Architecture](docs/architecture.md)

## Contributing
For development workflow, plan tracking, required checks, and release/versioning rules, see [CONTRIBUTING.md](CONTRIBUTING.md).
