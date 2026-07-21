# stylelint-bem — Stack

Technology choices, as decided.

## Language & runtime

- **TypeScript**, compiled for publishing (ESM output).
- **Node.js** ESM package.

## Core dependencies

- **stylelint 16.x** — peer dependency; only 16.x is supported.
- **postcss-selector-parser** — selector AST work (preferred over regex on raw selectors).
- PostCSS AST (via stylelint) for walking rules and nesting structure.

## Testing

- **Vitest** — test runner, ESM-native.
- stylelint `testRule`-style fixture harness for rule tests.
- Strict TDD: red → green → refactor, per AGENTS.md.

## Build & tooling

- **tsup or tsc** for build (to be finalized at scaffold time).
- **GitHub Actions** CI: test + build.
- Versioning via changesets or manual semver (to be finalized before first publish).

## Distribution

- npm package **`stylelint-bem`**, public.
- Rule namespace: **`plugin/stylelint-bem-*`**.
- Ships a **recommended shareable config** alongside individually enableable rules.

## Plugin architecture

- `src/index.ts` — plugin entry exporting all rules.
- `src/rules/<rule-name>/` — one folder per rule, implementation + tests colocated.
- `src/utils/` — shared BEM name parser, selector walker, per-file block index.
- `src/configs/recommended.ts` — shareable config.
- Shared secondary options across rules: `elementSeparator` (default `__`), `modifierSeparator` (default `--`), `ignoreSelectors`.
- No autofix — all rules report only.
