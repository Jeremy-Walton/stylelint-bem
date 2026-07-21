# stylelint-bem — Stack

Technology choices, as decided.

## Language & runtime

- **TypeScript**, compiled for publishing (ESM output).
- **Node.js** ESM package.

## Core dependencies

- **stylelint 16.x or 17.x** — peer dependency. Widened from "16.x only" 2026-07-21 after a real-world run against stylelint 17.10.0 worked with no changes; not yet cross-checked against stylelint's 16→17 migration notes (see `docs/plans/PLAN.md`).
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
- A **single** rule, namespaced **`plugin/stylelint-bem`** — not one rule per check (revised 2026-07-21; see `CHECKS.md`).
- Ships a **recommended shareable config** that enables the rule with all checks on.

## Plugin architecture

- `src/index.ts` — plugin entry exporting the one rule.
- `src/rules/stylelint-bem/index.ts` — the rule: option validation/resolution and dispatch to checks.
- `src/rules/stylelint-bem/checks/<check-name>.ts` — one file per check (implementation + tests colocated), invoked by the rule based on the `checks` option.
- `src/utils/` — shared BEM name parser, selector walker, per-file block/defined-class index.
- `src/configs/recommended.ts` — shareable config.
- Rule options: `elementSeparator` (default `__`), `modifierSeparator` (default `--`), `ignoreSelectors`, `checks` (per-check on/off, all default `true`).
- No autofix — the rule reports only.
