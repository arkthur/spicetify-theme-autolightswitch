# AutoLightSwitch: Copilot instructions

A Spicetify theme that turns Spotify's stock dark UI into a light one by inverting the lightness of every color with the native CSS `@function` `--invert-lightness`. It adds a light / system / dark switch to the top bar. An optional per-user watcher mirrors the OS theme into a text file. See [README.md](../README.md) for user-facing docs.

This file is always loaded, so it stays short. Details live in [instructions/](./instructions), which load by file pattern. Read the matching file before editing.

## Project map

| Path | What it is | Details |
| --- | --- | --- |
| `theme/` (`user.css`, `theme.js`, `color.ini`, `preview.png`) | **The product.** Shipped as-is to Spicetify. | [theme-css](./instructions/theme-css.instructions.md), [theme-js](./instructions/theme-js.instructions.md) |
| `manifest.json`, `README.md` | Spicetify Marketplace metadata and user docs | [docs-and-manifest](./instructions/docs-and-manifest.instructions.md) |
| `watcher/`, `scripts/update-checksums.mjs` | OS theme watcher (Windows C#/batch, macOS/Linux shell) and its checksums | [watcher](./instructions/watcher.instructions.md) |
| Root `*.config.ts`, `eslint.typegen.ts`, `stylelint-config-experimental/`, `tsconfig.json`, `package.json`, `.editorconfig` | Lint and format tooling only | [tooling](./instructions/tooling.instructions.md) |

## Node.js is tooling only

This is a Node.js project, but the theme has nothing to do with Node.

- The theme is **not compiled, transpiled, bundled or processed** in any way beyond what Spicetify itself does when applying a theme. `theme/user.css` and `theme/theme.js` are plain CSS and plain browser JavaScript, and they run exactly as written inside Spotify.
- Never add a build step, bundler, TypeScript, CSS preprocessor, minifier or runtime dependency to `theme/`. Never import npm packages or Node APIs from `theme/` files.
- Everything in `package.json`, `pnpm-lock.yaml`, the `*.config.ts` files and `stylelint-config-experimental/` exists for contributors (lint, format, checksums). It is not part of the shipped software.

## Commands

Package manager is pnpm (version pinned in `package.json`). Run `pnpm install` first.

| Command | Purpose |
| --- | --- |
| `pnpm lint` / `pnpm lint:fix` | ESLint (tooling `.ts` files and `theme/theme.js`) |
| `pnpm lint:css` | Stylelint on `theme/**/*.css` |
| `pnpm exec prettier --write <files>` | Format the files you changed with `prettier.config.ts` |
| `pnpm checksums` | Regenerate `watcher/SHA256SUMS` and the README checksum table |

There are no automated tests. Verify theme changes manually: copy `theme/` into Spicetify's `Themes` folder (see the README), run `spicetify apply`, and check the result in Spotify, in both light and dark modes. In DevTools, `__autoLightSwitch.stats` shows what the color patching did.

## Conventions

- **Formatting:** format every file you touch with Prettier using the repo config. `.editorconfig` applies (UTF-8, LF, 2 spaces). Do not reformat files you are not otherwise changing.
- **Commits:** Conventional Commits (`type(scope): subject`, for example `fix(theme): ...`, `feat(watcher): ...`, `docs: ...`, `chore: ...`). Imperative, lowercase subject. Commitlint will enforce this.
- **Comments:** only where the code needs clarification. Existing comments explain the _why_ of non-obvious browser behavior; keep them accurate when you change the code.
- **Naming:** everything the theme adds uses the `alsw` prefix (`--alsw-*` variables, `.alsw-*` classes, `autolightswitch:*` storage keys).
- **Scope:** make surgical changes. Do not fix unrelated issues in the same change.

## Keep these instructions current (required)

Every change that alters behavior, structure, commands, conventions, tooling or the files described here **must update the affected instruction files in the same change**:

- Added, renamed or removed a file or folder: update the project map above and the matching file in `instructions/`.
- Changed a script, config or convention: update Commands / Conventions here or in the relevant `instructions/*.instructions.md`.
- New area with its own rules: add a new `instructions/<topic>.instructions.md` with an `applyTo` glob and a `description`, and link it in the project map. Keep each file focused so unrelated context is never loaded.
- Before finishing, re-read the instruction files your change touches and fix anything now wrong. Also update [README.md](../README.md) where it is affected.
