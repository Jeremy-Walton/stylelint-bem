# stylelint-bem

A stylelint plugin (npm package `stylelint-bem`) that validates BEM methodology in CSS written with native nesting. Rules only apply to selectors that look like BEM (contain the configured separators) — plain/utility classes are ignored.

## Source of truth

- `PRODUCT.md` — what this project is and why (purpose, scope, non-goals). Read this first for context.
- `CHECKS.md` — the central list of checks the plugin runs and their semantics. Authoritative for check behavior.
- `README.md` — install, usage, the rule's options, and how to enable/disable individual checks.
- `STACK.md` — the technology choices we've made.
- `docs/bem.md` — the team's existing "Working with BEM" guide (an external resource; do not modify it).

## Key decisions

- A single rule, `plugin/stylelint-bem`; individual checks toggle via its `checks` option (all default `true` — opt-out, not opt-in). Check list and semantics: see `CHECKS.md`; usage/options: see `README.md`.
- Orphan checks look project-wide, not just the current file (see `CHECKS.md`); a `knownBlocks` option covers third-party classes that will never be defined in project CSS. No autofix — report only.
- Ships a recommended shareable config.

## Workflow rules

- **Strict TDD.** Write tests first, run them, confirm they fail for the right reason, then implement to green, then refactor. No behavior without a driving test.

## Commands

- `npm test` — Vitest suite
- `npm run build` — compile TS for publishing
- `npm run typecheck` — `tsc --noEmit` across both `src/` and `tests/` (via `tsconfig.tests.json`)

## Layout (once scaffolded)

- `src/rules/<rule-name>/` — rule implementation
- `src/utils/` — BEM name parser, selector walker, per-file block index, project-wide scan
- `src/index.ts` — plugin export; `src/configs/recommended.ts` — shareable config
- `tests/` — tests, mirroring `src/`'s directory structure 1:1 (e.g. `src/utils/bem-parser.ts` ↔ `tests/utils/bem-parser.test.ts`). Kept out of `src/` so it's obvious at a glance what's real code vs. test code. Import from either tree via the `@src/*`/`@tests/*` aliases instead of relative paths (see `STACK.md`).

## Conventions

- Violation messages should name the offending class and, where relevant, the missing/expected parent (e.g. the block a modifier is orphaned from).
- Prefer `postcss-selector-parser` for selector work over regex on raw selector strings.
- Non-BEM selectors and anything in the configured ignore list must never be flagged.
