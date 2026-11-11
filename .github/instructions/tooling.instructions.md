---
name: "Contributor tooling"
description: "Use when editing lint/format configs, TypeScript config files, stylelint-config-experimental, package.json or pnpm settings."
applyTo: "*.config.ts,eslint.typegen.ts,tsconfig.json,package.json,.editorconfig,.vscode/**,stylelint-config-experimental/**"
---

# Contributor tooling

All of this exists for contributors only. It is not shipped and must never leak into `theme/` (see "Node.js is tooling only" in [copilot-instructions.md](../copilot-instructions.md)).

- **Package manager:** pnpm, version pinned in `package.json` (`packageManager`). Do not use npm or yarn, and do not commit other lockfiles. Config files are `.ts` and run through Node's native TypeScript support (hence `--flag unstable_native_nodejs_ts_config` on the ESLint scripts).
- **ESLint** (`eslint.config.ts`): flat config. `typescript-eslint` strict and stylistic type-checked rules for root `*.ts` and `stylelint-config-experimental/*.ts`, `import-x` rules (sorted, grouped imports, no default exports except config files, no cycles), `eslint-config-prettier` last. The `jsConfig` block applies `js.configs.recommended` with `globals.browser` to every `**/*.js` file, which in practice is `theme/theme.js`. Rule names and options are type-checked against `eslint-typegen.d.ts`, which `eslint.typegen.ts` generates (gitignored). Do not edit it.
- **Prettier** (`prettier.config.ts`): the formatting source of truth. Double quotes, except single quotes in `.ts`. No trailing commas. 80 columns. `proseWrap: never` for Markdown. There is no format script, so run `pnpm exec prettier --write <files>`.
- **Stylelint** (`stylelint.config.ts`, `pnpm lint:css`): `stylelint-config-standard` plus the local `stylelint-config-experimental` for CSS only.
- **`stylelint-config-experimental/`**: a local shareable config (`index.ts`) and plugin (`plugin.ts`, `experimental/*` rules) that validate native `@function` and `@mixin` syntax, plus an explicit allowlist of experimental properties and selectors that stylelint's data doesn't know yet. When stylelint learns a feature, remove its entry. Never switch a rule off to silence a CSS error. Add a narrow allowlist entry instead.
- **TypeScript** (`tsconfig.json`): strict, `noEmit`, type-checking only for tooling files.
- **Editor** (`.editorconfig`, `.vscode/settings.json`): UTF-8, LF, 2 spaces. VS Code's built-in CSS lint ignores unknown at-rules because it doesn't know `@function`.
- **Dependencies:** devDependencies only. A new dependency needs a reason tied to contributor tooling, and `pnpm-lock.yaml` must be updated with it.
- **Commits:** Conventional Commits. When commitlint is added, its config and any hook belong here and must be documented in `copilot-instructions.md`.
- Windows note: `node_modules` files can be locked by editor language servers. If `pnpm install` fails with "Access is denied", close them and retry.

When you add or change a tool, script or config, update this file and the Commands table in `copilot-instructions.md`.
