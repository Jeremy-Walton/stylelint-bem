# stylelint-bem

A stylelint plugin (npm package `stylelint-bem`) that validates BEM methodology in CSS written with native nesting. Rules only apply to selectors that look like BEM (contain the configured separators) — plain/utility classes are ignored.

## Source of truth

- `PRODUCT.md` — what this project is and why (purpose, scope, non-goals). Read this first for context.
- `CHECKS.md` — the central list of checks the plugin runs and their semantics. Authoritative for check behavior.
- `README.md` — install, usage, the rule's options, and how to enable/disable individual checks.
- `STACK.md` — the technology choices we've made.
- `docs/bem.md` — the team's existing "Working with BEM" guide (an external resource; do not modify it).

## Key decisions

- Five rules, one per check, namespaced `stylelint-bem/<check-name>` (e.g. `stylelint-bem/valid-name`) — each independently enabled/disabled/configured, not a single mega-rule with a `checks` option. Standard stylelint two-arg config shape (primary option + secondary options object) per rule. Check list and semantics: see `CHECKS.md`; usage/options: see `README.md`.
- Orphan checks look project-wide, not just the current file (see `CHECKS.md`); a `knownBlocks` option covers third-party classes that will never be defined in project CSS. No autofix — report only.
- Ships a recommended shareable config.
- Selector shape is classified once by `src/utils/selector-walker.ts` and exposed on `ClassNode`; a chained class's root is a discriminated union (`chainRoot: { kind: 'ampersand' | 'classless' | 'classes' }`) so consumers switch on `kind` rather than decoding sentinel fields.
- BEM *name* algebra (parse/format, block and parent derivation, `isModifierOf`) lives in `src/utils/bem-parser.ts` by cohesion — even a single-caller helper — while selector- and rule-tree logic stays in the rule that needs it. Separator options are always passed explicitly, never global.

## Workflow rules

- **Strict TDD.** Write tests first, run them, confirm they fail for the right reason, then implement to green, then refactor. No behavior without a driving test.

## Commands

- `yarn test` — Vitest suite
- `yarn build` — compile TS for publishing
- `yarn typecheck` — `tsc --noEmit` across both `src/` and `tests/` (via `tsconfig.tests.json`)

## Layout (once scaffolded)

- `src/rules/<rule-name>/` — rule implementation
- `src/utils/` — BEM name parser, selector walker, per-file block index, project-wide scan
- `src/index.ts` — plugin export; `src/configs/recommended.ts` — shareable config
- `tests/` — tests, mirroring `src/`'s directory structure 1:1 (e.g. `src/utils/bem-parser.ts` ↔ `tests/utils/bem-parser.test.ts`). Kept out of `src/` so it's obvious at a glance what's real code vs. test code. Import from either tree via the `@src/*`/`@tests/*` aliases instead of relative paths (see `STACK.md`).
- `docs/plans/` — planning documents and session handoff docs.

## Conventions

- Violation messages should name the offending class and, where relevant, the missing/expected parent (e.g. the block a modifier is orphaned from).
- Prefer `postcss-selector-parser` for selector work over regex on raw selector strings.
- Only selectors that participate in BEM are checked — those using the configured separators, plus a bare block confirmed by a BEM element/modifier that references it (see `CHECKS.md`). Plain/utility classes and anything in the configured ignore list are never flagged.
- Bundle the state for one item under inspection into a small context type (e.g. `RuleContext`, or `require-nesting`'s `NestingCheck`) rather than threading many parallel parameters.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (Jeremy-Walton/stylelint-bem), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
