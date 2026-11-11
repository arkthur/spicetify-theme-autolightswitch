---
name: "Theme CSS and palette"
description: "Use when editing the theme stylesheet, the color inversion math, the --spice-* palette or color.ini."
applyTo: "theme/user.css,theme/color.ini"
---

# `theme/user.css` and `theme/color.ini`

Plain CSS loaded by Spicetify. No build step. Needs Chromium 139+ (native `@function`).

## How the inversion works

- `--invert-lightness(<color>)` (an `oklch` lightness flip) and `--invert-lightness-rgb(r, g, b)` (for `"R,G,B"` triplets) are native CSS `@function`s defined at the top of the file.
- Both scale by `--alsw-invert`: `1` = inverted (light), `0` = Spotify's stock dark colors, values in between blend.
- `:root` defines `--spice-*-original` (stock dark palette) and rebuilds each `--spice-*` and `--spice-rgb-*` variable by wrapping the original in the functions.
- Selecting the mode: the `@media (prefers-color-scheme: dark)` block (fallback, `--alsw-invert: 0`) comes **before** `:root.alsw-light` / `:root.alsw-dark` (set by `theme/theme.js`). Keep this order: later rules override `--alsw-invert`.
- Hard-coded colors that Spicetify can't remap (scrims, shadows, Encore tokens like `--background-base`) are **not** handled here. `theme/theme.js` wraps them at runtime (see [theme-js](./theme-js.instructions.md)).

## Rules

- `theme/color.ini` holds Spotify's stock dark palette, and the `--spice-*-original` variables in `user.css` must hold the same values. Change both together (plus the matching `--spice-rgb-*-original` triplets).
- Anything that must stay un-inverted or be driven by the switch uses `--alsw-*` variables. `theme.js` never rewrites `--spice-*` and `--alsw-*` properties.
- The native window buttons and the menu button are drawn by Spotify on top of the page and can't be recolored. The theme paints gray outlines behind their glyphs, positioned in native pixels (hence `--alsw-native-scale`). The pixel coordinates in the comments are for Windows at 100% scale; keep the comments in sync when changing the shapes. `theme.js` toggles `.alsw-native-buttons-hidden` and `.alsw-maximized` for these.
- The top bar switch is styled under `.alsw-mode-switch`; its markup is created in `theme.js`. Change both together.
- The file opens with `/* stylelint-disable selector-class-pattern */` because Spotify's class names are not kebab-case.

## Validate

Run `pnpm lint:css` and `pnpm exec prettier --write theme/user.css`. Stylelint uses `stylelint-config-standard` plus `stylelint-config-experimental` (see [tooling](./tooling.instructions.md)), which knows `@function`. VS Code's built-in CSS linter does not, and that is intentionally silenced in `.vscode/settings.json`. Then check visually in Spotify (README, "Install").
