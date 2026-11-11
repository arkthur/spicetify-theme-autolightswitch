---
name: "Theme JavaScript"
description: "Use when editing theme/theme.js: runtime color patching, the theme switch, system theme polling."
applyTo: "theme/theme.js"
---

# `theme/theme.js`

A single IIFE (`autoLightSwitch`) injected by Spicetify (`inject_theme_js 1`, or the `include` URL in `manifest.json` for Marketplace installs). It runs in Spotify's Chromium, **not** in Node: plain browser JavaScript, no imports, no build, no dependencies. ESLint checks it with `js.configs.recommended` and browser globals (`globals.browser`), which catches typos and undefined names but not runtime behavior. Test it in Spotify. APIs missing from `globals.browser` (very new CSSOM classes) must be guarded with `typeof` like the existing code.

## Responsibilities

1. **Color inversion.** Wraps every hard-coded color in a stylesheet rule or inline `style` with `--invert-lightness()`.
   - Rules are edited in place through the CSSOM (like a DevTools edit), so position, `@layer`, specificity and nesting are preserved. Never inject a replacement stylesheet.
   - Skipped on purpose: the theme's own sheets (`user.css`, `colors.css`, or `<style class="marketplaceCSS">` for Marketplace installs), `light-theme` scoped rules, `@function` rules, properties starting with `--spice-` or `--alsw-` (`keepProperty`), colors that contain `var()`, and anything inside `url(...)`.
   - Already-wrapped values are left alone, which keeps the inline-style `MutationObserver` from looping.
   - Debug from DevTools with `__autoLightSwitch.stats`.
2. **System theme.** Spotify's Chromium always reports `prefers-color-scheme: dark`, so the OS theme is read by polling `system-theme.txt` (`light` or `dark`, written by the [watcher](./watcher.instructions.md)). Polling every 2 s, or every 10 s while the file is missing. Without the file, `user.css` falls back to the media query.
3. **Theme switch.** Light / system / dark buttons, prepended to `.main-actionButtons` (left of the "What's New" bell) and re-inserted when React rebuilds the bar. The choice is stored in `localStorage` under `autolightswitch:mode`. `applyTheme()` toggles `html.alsw-light` / `html.alsw-dark`, which `user.css` turns into `--alsw-invert`.
4. **Native buttons.** Wraps `Spicetify.Platform.NativeAPI.setWindowButtonsVisibility` (retrying until Spicetify loads) to toggle `.alsw-native-buttons-hidden`, and toggles `.alsw-maximized` on resize.

## Rules

- Spotify's DOM and class names (`.main-actionButtons`, Encore tokens) are private and change between releases. Keep selectors few, tolerant and commented.
- Wrap `localStorage` and `fetch` in `try/catch` like the existing code. The theme must keep working when they fail.
- New classes, variables and storage keys use the `alsw` / `autolightswitch` prefix. Any class you add here needs matching CSS in [theme-css](./theme-css.instructions.md).
- Keep the header comment in sync with the code when responsibilities change.
- Validate: `pnpm lint`, `pnpm exec prettier --write theme/theme.js`, then `spicetify apply` and test in Spotify (all three modes, with and without the watcher's `system-theme.txt`).
