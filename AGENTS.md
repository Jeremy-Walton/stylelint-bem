# stylelint-bem

A stylelint plugin (npm package `stylelint-bem`) that validates BEM methodology in CSS written with native nesting. Rules only apply to selectors that look like BEM (contain the configured separators) — plain/utility classes are ignored.

## Source of truth

- `PRODUCT.md` — what this project is and why (purpose, scope, non-goals). Read this first for context.
- `RULES.md` — the central list of lint rules, their semantics, and shared options. Authoritative for rule behavior.
- `STACK.md` — the technology choices we've made.
- `docs/bem.md` — the team's existing "Working with BEM" guide (an external resource; do not modify it).
- `docs/plans/PLAN.md` — decision log, phase breakdown, current status, and handoff contract. Read before doing any work. Do not re-ask questions already answered in its Decisions table.

## Key decisions

- Rule namespace: `plugin/stylelint-bem-*`. Rule list and semantics: see `RULES.md`.
- Orphan checks are same-file only. No autofix — report only.
- Ships a recommended shareable config.

## Workflow rules

1. **Strict TDD.** Write tests first, run them, confirm they fail for the right reason, then implement to green, then refactor. No behavior without a driving test.
2. **Phase gates.** Work proceeds in the phases defined in PLAN.md. At the end of each phase, STOP and ask Jeremy for review before starting the next. Review adjustments become new failing tests first.
3. **Keep PLAN.md current.** Update its "Current status" line and record review adjustments as you go.

## Commands

- `npm test` — Vitest suite
- `npm run build` — compile TS for publishing

## Layout (once scaffolded)

- `src/rules/<rule-name>/` — rule implementation + its tests
- `src/utils/` — BEM name parser, selector walker, per-file block index
- `src/index.ts` — plugin export; `src/configs/recommended.ts` — shareable config
- `docs/plans/` — planning docs

## Conventions

- Violation messages should name the offending class and, where relevant, the missing/expected parent (e.g. the block a modifier is orphaned from).
- Prefer `postcss-selector-parser` for selector work over regex on raw selector strings.
- Non-BEM selectors and anything in the configured ignore list must never be flagged.
