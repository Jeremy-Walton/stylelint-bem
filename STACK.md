# stylelint-bem — Stack

Technology choices, as decided.

## Language & runtime

- **TypeScript**, compiled for publishing (ESM output).
- **Node.js** ESM package.

## Core dependencies

- **stylelint 16.x or 17.x** — peer dependency. Widened from "16.x only" 2026-07-21 after a real-world run against stylelint 17.10.0 worked with no changes; not yet cross-checked against stylelint's 16→17 migration notes — narrow back to `^16.0.0` if a real incompatibility ever surfaces.
- **postcss-selector-parser** — selector AST work (preferred over regex on raw selectors).
- PostCSS AST (via stylelint) for walking rules and nesting structure.
- **postcss-scss** — used only by the project-wide scanner (`src/utils/project-scan.ts`) to parse `.scss` files it discovers on disk (added after a real-world SCSS dogfood run crashed the plain CSS parser on a `//` line comment — invalid in CSS, valid in SCSS). It parses plain CSS fine too (a syntax superset), so it's used for every scanned file, not just `.scss`, avoiding a branch on extension. This does **not** make the plugin SCSS-aware in general — the rule itself still only ever sees whatever PostCSS AST stylelint hands it for the file actually being linted, parsed with whatever `customSyntax` the *consuming project's own* stylelint config specifies (that's a stylelint-level setting, invisible to a plugin rule). Scope is deliberately narrow: SCSS files can be scanned so a block defined in one satisfies the orphan checks for a class elsewhere. **Dependency type — decided 2026-07-21 (asked, not assumed):** kept as a regular `dependency`, not an optional peer dependency. `postcss-scss` has zero dependencies of its own (~19 KB, peer-deps only on `postcss`, which is already in the tree via `postcss` itself and stylelint), so the install-footprint argument for making it optional is weak. The correctness downside of making it optional would be real: since it parses *every* scanned file (not just `.scss`), going optional means either an extension branch or a dynamic `import()` with a fallback — and a consumer with `.scss` files who forgets to install the peer dependency would get silent under-scanning (files skipped from the defined-class index with no warning), which is exactly the "quiet false-positive risk" the original SCSS dogfood finding flagged, just moved up a level.

## Testing

- **Vitest** — test runner, ESM-native.
- stylelint `testRule`-style fixture harness for rule tests.
- Strict TDD: red → green → refactor, per AGENTS.md.
- Tests live under top-level `tests/`, mirroring `src/`'s directory structure 1:1, not colocated with source files.
- Path aliases `@src/*` and `@tests/*` (mapped in `tsconfig.json`'s `paths`, and in `vitest.config.ts`'s `resolve.alias`) are used for imports instead of relative paths, e.g. `import { parseClassName } from '@src/utils/bem-parser.js'`. Aliases only affect module resolution for TypeScript/Vitest — the published build (`tsup`) never sees them, since nothing in `src/` currently imports via an alias.

## Build & tooling

- **tsup** for build — chosen at scaffold time (Phase 0) for its minimal-config ESM + `.d.ts` output.
- **GitHub Actions** CI: test + build (`.github/workflows/ci.yml`).
- **Manual semver** for versioning (decided 2026-07-21, Phase 4) — no changesets tooling; bump `package.json`'s version and `CHANGELOG.md` by hand at publish time.

## Distribution

- npm package **`stylelint-bem`**, public.
- **Five** rules, one per check, namespaced **`stylelint-bem/<check-name>`** — not a single mega-rule with a `checks` option (revised 2026-07-21, second revision same day — see `CHECKS.md`). Each rule uses the standard stylelint two-arg config shape (primary option + secondary options object).
- Ships a **recommended shareable config** that enables all five rules with their defaults.

## Plugin architecture

- `src/index.ts` — plugin entry exporting all five rules.
- `src/rules/<check-name>/index.ts` — one directory per rule (`valid-name`, `no-orphaned-element`, `no-orphaned-modifier`, `no-double-nested-element`, `require-nesting`): option validation/resolution and check logic together, since each rule is exactly one check now.
- `src/rules/shared/rule-context.ts` — shared helpers (`forEachBemClass`, `reportBemViolation`, `isDefinedOrKnown`) and the `RuleContext` type, reused by all five rules.
- `src/utils/` — shared BEM name parser, selector walker, per-file block/defined-class index, project-wide file scan.
- `src/configs/recommended.ts` — shareable config.
- Secondary options, all five rules: `elementSeparator` (default `__`), `modifierSeparator` (default `--`), `ignoreSelectors`. `knownBlocks` additionally on the two orphan rules. `require-nesting`'s primary option carries its `strict`/`weak` mode instead of a boolean.
- No autofix — rules report only.
