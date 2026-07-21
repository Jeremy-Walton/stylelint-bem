# stylelint-bem — Implementation Plan

A stylelint plugin that validates BEM methodology in CSS, using native nesting. Rules apply only to selectors that look like BEM (contain configured separators), not every selector.

## Decisions (from interview, 2026-07-21)

| Topic | Decision |
|---|---|
| Language | TypeScript, compiled for publishing |
| Stylelint | 16.x only (ESM) |
| BEM detection | Selector contains element/modifier separator; ignore list configurable |
| Name grammar | Parts must be kebab-case; separator-containing classes with non-kebab parts are invalid BEM, flagged by new `valid-name` rule (decided 2026-07-21) |
| Separators | Configurable; defaults `__` (element), `--` (modifier) |
| Nesting form | Full selector only: `.block { .block__el {} }` — no `&__el` shorthand |
| Modifier form | Compound with `&`: `.block { &.block--mod {} }` |
| Element modifiers | `.block__el--mod` valid, must nest under `.block__el`; `.block--mod__el` invalid |
| Orphan scope | Parent `.block` must be defined in the same file |
| Autofix | None — report only |
| Tests | Vitest + stylelint's testRule-style harness; strict TDD (see below) |
| Distribution | Publish to npm; also ship a recommended shareable config |
| Package name | `stylelint-bem` (confirmed) |
| Rule namespace | `plugin/stylelint-bem-*` (confirmed) |

Planned rules: see `RULES.md` (repo root) — the central, authoritative rule list.

---

## TDD workflow (applies to every phase)

Each phase is red → green → refactor:

1. **Red:** write the phase's tests first (valid/invalid fixtures, expected messages). Run them and confirm they fail for the right reason (rule missing/unimplemented — not a harness error).
2. **Green:** implement the minimum to make them pass. No behavior without a driving test.
3. **Refactor:** clean up with the suite green.

Each phase's PAUSE happens at green — reviewer adjustments become new failing tests first, then fixes.

---

## Phase 0 — Scaffold & shared core

- Init package `stylelint-bem`, TS config, Vitest, ESLint/Prettier optional, stylelint 16 as peer dep.
- ESM build output (tsup or tsc).
- Shared core:
  - BEM name parser: split class into block / element / modifier given configurable separators; classify "is this trying to be BEM".
  - Selector walker utilities (postcss-selector-parser).
  - Per-file block index (classes defined at rule roots) for orphan rules.
  - Shared secondary options: `elementSeparator`, `modifierSeparator`, `ignoreSelectors`.
- Test harness wired up first; parser unit tests written **before** the parser (block/element/modifier/element+modifier/double-element/non-kebab-part/ignored cases), confirmed red, then implemented to green.

**Acceptance:** parser tests demonstrably went red → green; `npm test` green.

⏸ **PAUSE — review parser semantics before writing rules.**

## Phase 1 — Orphan rules

- **Red:** write full fixture tests for `no-orphaned-modifier` and `no-orphaned-element` — valid (block present, nested or not), invalid (missing block, expected messages naming it), custom separators, ignore list, non-BEM selectors untouched. Confirm they fail.
- **Green:** implement both rules (same-file block lookup, shared index from Phase 0).

**Acceptance:** tests went red → green; clear violation messages naming the missing block.

⏸ **PAUSE — review messages/behavior.**

## Phase 2 — Grammar rules (name shape)

- **Red:** tests for `no-double-nested-element` — flag `block__el__other` (message suggests flattening to `block__other`) and `block--mod__el`; custom separators; tricky names (single `_`/`-` inside names) must not flag. Tests for `valid-name` — flag non-kebab-case parts (`.myBlock--active`, `.card__Title`); kebab parts with digits/dashes pass. Confirm failing.
- **Green:** implement both rules.

**Acceptance:** tests went red → green; no false positives on names containing single `_`/`-`.

⏸ **PAUSE — review edge-case handling.**

## Phase 3 — Nesting rule (the big one)

- **Red:** extensive fixtures for `require-nesting`, written and failing before any implementation:
  - `.block__el` must appear as a full selector nested (at any depth) inside a `.block` rule.
  - `.block--mod` must appear as `&.block--mod` compound directly under `.block`.
  - `.block__el--mod` must appear as `&.block__el--mod` under `.block__el` (which itself is nested in `.block`).
  - Selector lists, at-rules (`@media` inside blocks), deeper nesting, combinators.
- **Green:** implement, incrementally driving each fixture group.

**Acceptance:** all listed shapes covered by tests that went red → green; behavior inside `@media`/`@supports` decided and tested.

⏸ **PAUSE — review; this rule has the most judgment calls.**

## Phase 4 — Preset, docs, publish prep

- Recommended shareable config enabling all rules.
- README: install, usage, per-rule docs with valid/invalid examples, options.
- Per-rule docs pages, package metadata, `files`/`exports`, CI (GitHub Actions: test + build), changesets or manual semver.
- Dry-run `npm publish --dry-run`.

**Acceptance:** clean pack contents; docs cover every rule and option.

⏸ **PAUSE — review docs & package before any publish.**

## Phase 5 — Verification & dogfood

- **Red first:** write the end-to-end expectation (exact violations per fixture file) as an integration test before running; build a sample `components/` folder with realistic good/bad CSS; run the plugin end-to-end via stylelint CLI.
- Fuzz-ish pass: weird selectors (`:is()`, attribute selectors, multiple classes) must not crash or false-positive.
- Fix findings; final review.

**Acceptance:** end-to-end run matches expected violations exactly.

---

## Handoff

**Purpose of this section:** allow a fresh session/model to resume with zero prior chat context.

- **Read first:** `AGENTS.md` (root) → `PRODUCT.md`, `RULES.md`, `STACK.md`, `docs/bem.md` → this file. The root docs are durable and outlive this plan — behavior questions are answered by `RULES.md`, tech questions by `STACK.md`; this plan holds only sequencing, status, and decision history. If this plan conflicts with the root docs, the root docs win (and flag the conflict).
- **Source of truth for decisions:** the table above. Do not re-interview; ask only about genuinely new ambiguities.
- **Current status:** _Phase 1 complete (2026-07-21), awaiting review._ ← update this line as phases complete (e.g. "Phase 2 complete, awaiting review", plus any review adjustments as bullet notes under the phase).
  - **Reversed the earlier "defer wiring to Phase 4" call.** `src/index.ts` now aggregates every rule plugin as each one lands (currently both Phase 1 rules), and `src/configs/recommended.ts` enables them all — both are kept live from here on, not batched into Phase 4. Reasoning: leaving them as empty stubs meant the package didn't do anything end-to-end for two more phases, which is exactly what caused confusion when reviewing Phase 1. Verified for real, not just via the internal test harness: built with `npm run build` and ran the actual `stylelint` CLI against a sample file using `dist/configs/recommended.js` — well-formed BEM passed clean, `.orphan__thing` and `.another--modifier` were caught with the expected messages. Phase 4 now only needs docs/package metadata/CI, not the config wiring itself.
  - **Phase 0:**
    - Build tool: **tsup** (chosen at scaffold time — ESM + `.d.ts` output with minimal config).
    - Scaffolded: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`.
    - Shared core implemented with red→green TDD: `src/utils/bem-parser.ts` (`parseClassName`, `isKebabCase`), `src/utils/selector-walker.ts` (`getClassNames`, `getClassNodes`), `src/utils/block-index.ts` (`buildBlockIndex`). (`parseClassName` renamed from `parseBemClassName` per review — the module name already says "bem".)
    - `src/index.ts` and `src/configs/recommended.ts` started as empty structural stubs in Phase 0 (no rules existed yet, so nothing to wire up). Superseded in Phase 1 — see below.
    - `buildBlockIndex` only registers a block when a rule's selector is a **single**, non-BEM class (e.g. `.card`); compound multi-class selectors (`.card.dark`) are not indexed — a deliberately conservative default that Phase 1 kept as-is (no fixture needed it loosened).
    - Not yet a git repository — no `git init` was run since it wasn't part of the Phase 0 scope; flag if you want that set up.
  - **Phase 1:**
    - Added `src/utils/rule-options.ts` (`resolveSeparatorOptions`, `isIgnoredSelector`, shared `secondaryOptionsSchema`) — common to all rules per RULES.md's shared secondary options.
    - Added `src/test-utils/test-rule.ts` — a small `testRule({ plugin, ruleName, config, accept, reject })` fixture harness wrapping `stylelint.lint()`; not itself TDD'd (test infrastructure, not app behavior).
    - Implemented `plugin/stylelint-bem-no-orphaned-element` and `plugin/stylelint-bem-no-orphaned-modifier`, each red→green via fixture tests (24 tests total across both).
    - **Rule-ownership design (revised after review):** `no-orphaned-element` fires when `segments[0].separator === 'element'` and checks that the root block is defined — unchanged. `no-orphaned-modifier` fires when the **last** segment is `modifier` (not the first) and checks that the modifier's *immediate target* is defined — the class name with the trailing modifier segment stripped (`formatClassName(block, segments.slice(0, -1), options)`), looked up in a new, unfiltered `buildDefinedClassIndex` (any single-class rule, BEM or not; `buildBlockIndex` is now a BEM-filtered view over it). So `.card__title--large` is checked by **both** rules independently — element rule requires `.card`, modifier rule requires `.card__title` — each reporting its own specific missing piece rather than one rule reporting on the other's behalf. `.card--featured__title` (modifier-then-element — invalid; a modifier can't have an element after it) is checked by **neither** orphan rule, since its first segment isn't element and its last segment isn't modifier; that shape is entirely `no-double-nested-element`'s job in Phase 2.
    - Added `formatClassName(block, segments, options)` to `bem-parser.ts` — the inverse of `parseClassName`, used to reconstruct a modifier's immediate target string.
    - `ignoreSelectors` matches against each individual selector in a rule's selector list (not the whole comma-separated group, not just the class name) — string entries require an exact match, regex entries use `.test()`.
    - Warning position uses `postcss-selector-parser`'s `sourceIndex` (via `getClassNodes`) passed as `index`/`endIndex` to `stylelint.utils.report`, matching the convention used by stylelint's own core rules (e.g. `selector-class-pattern`) for precise per-class caret placement.
    - `src/index.ts` now exports `[noOrphanedElement, noOrphanedModifier]` (both rule plugins); `src/configs/recommended.ts` imports that same array as `plugins` (not the string `'stylelint-bem'`) and sets both rule names to `true` — bundling the actual objects avoids relying on self-resolving the package's own name during local dev/testing. Added `src/index.test.ts` and `src/configs/recommended.test.ts` (red→green) covering both the aggregation and an end-to-end `stylelint.lint()` run.
- **Known quirks:** `docs/bem.md` is an external team resource — do not modify; its dead link to `ui-building-guide.md` is intentional.
- **Workflow contract:** strict TDD per the "TDD workflow" section — tests first, confirm red, implement to green. Complete one phase, then STOP and ask Jeremy for review before starting the next. Review adjustments start as new failing tests; record them in this file, then proceed.
- **Repo layout (once scaffolded):** `src/rules/<rule-name>/` (rule + tests), `src/utils/` (parser, walker, block index), `src/index.ts` (plugin export), `src/configs/recommended.ts`.
- **Run:** `npm test` (Vitest), `npm run build`.
- **Open items:** decide `@media` semantics at Phase 3; finalize build tool (tsup vs tsc) at Phase 0; finalize versioning (changesets vs manual) at Phase 4.
- **Rule count check:** five rules total — `valid-name`, `no-orphaned-element`, `no-orphaned-modifier`, `no-double-nested-element`, `require-nesting`. If `RULES.md` lists more, it has been updated since; follow it.
