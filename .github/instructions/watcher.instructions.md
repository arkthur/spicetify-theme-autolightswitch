---
name: "System theme watcher"
description: "Use when editing the OS theme watcher scripts, their installers, or the checksum tooling."
applyTo: "watcher/**,scripts/**"
---

# `watcher/` and `scripts/update-checksums.mjs`

Optional helper that lets the theme's **system** mode follow the OS. It writes the single word `light` or `dark` to `system-theme.txt` in Spotify's `xpui` folder, which `theme/theme.js` polls. Also see the "Following the system theme" section of the README.

| File | Platform | Notes |
| --- | --- | --- |
| `SystemThemeWatcher.cs`, `install.bat`, `uninstall.bat` | Windows | `install.bat` compiles the C# with the .NET Framework compiler that ships with Windows (no SDK) and adds a Startup shortcut. Reads `AppsUseLightTheme`, sleeping until the registry value changes. |
| `install.sh`, `system-theme-watcher.sh` | macOS, Linux | macOS: launchd agent. Linux: systemd user service with an XDG autostart fallback. Both are **untested**. |
| `SHA256SUMS` | all | Generated. Never edit by hand. |

## Rules

- **Trust is the feature.** Per-user install only (no admin or root), no network access, nothing downloaded, no shipped binaries (Windows builds from source). Reads only the OS appearance setting and Spicetify's config (to find `xpui`). Keep the scripts short and readable.
- `spicetify apply` recreates `xpui`, so the watcher rewrites `system-theme.txt` when it is missing or stale (re-check about every 30 s). Preserve this.
- `install` and `uninstall` must stay symmetric: uninstall removes everything install creates, including `system-theme.txt`, and installers stop a running copy before replacing it.
- Line endings are forced to LF for `*.bat`, `*.cs` and `*.sh` by `.gitattributes`. The checksums depend on the exact bytes, so do not change line endings.
- The macOS and Linux scripts are untested. Do not describe them as tested anywhere.

## After any change in `watcher/` (required)

1. Run `pnpm checksums`. It rewrites `watcher/SHA256SUMS` and the table between the `checksums:start` / `checksums:end` markers in `README.md`. Do not edit that table by hand.
2. If you add or remove a file in `watcher/`, update the `FILES` list in `scripts/update-checksums.mjs`.
3. Update the README when it is affected: the line counts ("about 330 lines in total", "about 70 lines"), install locations, what the watcher reads or writes, and the Microsoft false-positive note for `system-theme-watcher.sh`. Its VirusTotal link and "60 of 61 engines" claim refer to a specific file hash and are stale after any edit to that script. Flag this to the maintainer instead of inventing new scan results.
