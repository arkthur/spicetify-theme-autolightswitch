---
name: "README and Marketplace manifest"
description: "Use when editing README.md, manifest.json, the license, or anything about how the theme is installed or published."
applyTo: "README.md,manifest.json"
---

# README and `manifest.json`

## `manifest.json` (Spicetify Marketplace)

- `usercss` → `theme/user.css`, `schemes` → `theme/color.ini`, `preview` → `theme/preview.png`, `readme` → `README.md`.
- `include` lists `https://arkthur.github.io/spicetify-theme-autolightswitch/theme/theme.js` (served from the `main` branch, which is `"branch"` in the manifest). Marketplace installs fetch these files by these paths, so renaming or moving any of them breaks installs. Update the manifest in the same change.
- Update `description` and `tags` only when the theme's behavior changes. The description must match the README's first paragraph.

## `README.md`

- User-facing: requirements (Chromium 139+ for native `@function`), install (Marketplace and manual), the optional system theme watcher, development, license.
- The checksum table between `<!-- checksums:start -->` and `<!-- checksums:end -->` is **generated** by `pnpm checksums`. Never edit it by hand, and keep the `prettier-ignore` comments around it.
- Keep the watcher section accurate (see [watcher](./watcher.instructions.md)): install commands, what it reads and writes, install locations, "untested" markers for macOS and Linux.
- Keep the "Development" section in sync with the `package.json` scripts.
- Markdown is formatted by Prettier (`proseWrap: never`, so one paragraph per line).
- The theme is MIT licensed (`LICENSE`).
