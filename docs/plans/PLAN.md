# stylelint-bem — Implementation Plan

A stylelint plugin that validates BEM methodology in CSS, using native nesting. Rules apply only to selectors that look like BEM (contain configured separators), not every selector.

## Decisions (from interview, 2026-07-21)

| Topic | Decision |
|---|---|
| Language | TypeScript, compiled for publishing |
| Stylelint | ~~16.x only (ESM)~~ **Widened 2026-07-21:** `^16.0.0 \|\| ^17.0.0`. A real run against stylelint 17.10.0 (see the real-project dogfood in Handoff) worked with no changes; not yet cross-checked against stylelint's own 16→17 migration notes, so treat as "observed to work once," not "verified compatible." |
| BEM detection | Selector contains element/modifier separator; ignore list configurable |
| Name grammar | Parts must be kebab-case; separator-containing classes with non-kebab parts are invalid BEM, flagged by new `valid-name` rule (decided 2026-07-21) |
| Separators | Configurable; defaults `__` (element), `--` (modifier) |
| Nesting form | Full selector only: `.block { .block__el {} }` — no `&__el` shorthand |
| Modifier form | Compound with `&`: `.block { &.block--mod {} }` |
| Element modifiers | `.block__el--mod` valid, must nest under `.block__el`; `.block--mod__el` invalid |
| Orphan scope | ~~Parent `.block` must be defined in the same file~~ **Superseded 2026-07-21:** project-wide — a block defined anywhere in the project satisfies the check, not just the current file. Changed after a real-world dogfood (see Handoff) found same-file scope was ~100% noise on a real codebase that splits shared component definitions from page-specific overrides across files. **Not yet implemented** — this is the next task; see the "Project-wide orphan scope" bullet in Handoff for the open implementation questions (stylelint gives a rule only the current file's AST, so this needs the plugin to do its own project-wide file discovery/parsing, which the same-file version never had to do). |
| Autofix | None — report only |
| Tests | Vitest + stylelint's testRule-style harness; strict TDD (see below) |
| Distribution | Publish to npm; also ship a recommended shareable config |
| Package name | `stylelint-bem` (confirmed) |
| Rule namespace | ~~`plugin/stylelint-bem-*` (one rule per check)~~ **Superseded 2026-07-21:** a single rule, `plugin/stylelint-bem`, whose primary option is an options object (mirrors `stylelint-selector-bem-pattern`'s style). Each former "rule" becomes a `checks.<name>` boolean, opt-out (all default `true`). Reason: stylelint never runs a rule that isn't a key in `config.rules`, so per-check rules are inherently opt-in; folding checks into one rule's options is the only way to make them opt-out by default. |

Checks: see `CHECKS.md` (repo root) — the central, authoritative list of checks. Usage/options: see `README.md`.

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

## Phase 1 — Orphan checks

- **Red:** write full fixture tests for the `noOrphanedModifier` and `noOrphanedElement` checks — valid (block present, nested or not), invalid (missing block, expected messages naming it), custom separators, ignore list, non-BEM selectors untouched. Confirm they fail.
- **Green:** implement both checks (same-file block lookup, shared index from Phase 0).

**Acceptance:** tests went red → green; clear violation messages naming the missing block.

⏸ **PAUSE — review messages/behavior.**

_(Mid-phase, superseded the one-rule-per-check namespace with a single `plugin/stylelint-bem` rule whose options include `checks.noOrphanedElement`/`checks.noOrphanedModifier` — see the Decisions table and the Phase 1 log below.)_

## Phase 2 — Grammar checks (name shape)

- **Red:** tests for the `noDoubleNestedElement` check — flag `block__el__other` (message suggests flattening to `block__other`) and `block--mod__el`; custom separators; tricky names (single `_`/`-` inside names) must not flag. Tests for `validName` — flag non-kebab-case parts (`.myBlock--active`, `.card__Title`); kebab parts with digits/dashes pass. Confirm failing.
- **Green:** implement both checks.

**Acceptance:** tests went red → green; no false positives on names containing single `_`/`-`.

⏸ **PAUSE — review edge-case handling.**

## Phase 3 — Nesting check (the big one)

- **Red:** extensive fixtures for the `requireNesting` check, written and failing before any implementation:
  - `.block__el` must appear as a full selector nested (at any depth) inside a `.block` rule.
  - `.block--mod` must appear as `&.block--mod` compound directly under `.block`.
  - `.block__el--mod` must appear as `&.block__el--mod` under `.block__el` (which itself is nested in `.block`).
  - Selector lists, at-rules (`@media` inside blocks), deeper nesting, combinators.
- **Green:** implement, incrementally driving each fixture group.

**Acceptance:** all listed shapes covered by tests that went red → green; behavior inside `@media`/`@supports` decided and tested.

⏸ **PAUSE — review; this check has the most judgment calls.**

## Phase 4 — Preset, docs, publish prep

- Recommended shareable config enabling the rule with all checks on. _(Already done as of Phase 1's redesign — see log below. This phase now only needs docs/metadata/CI.)_
- README: install, usage, the rule's options, per-check docs with valid/invalid examples.
- Docs pages, package metadata, `files`/`exports`, CI (GitHub Actions: test + build), changesets or manual semver.
- Dry-run `npm publish --dry-run`.

**Acceptance:** clean pack contents; docs cover every check and option.

⏸ **PAUSE — review docs & package before any publish.**

## Phase 5 — Verification & dogfood

- **Red first:** write the end-to-end expectation (exact violations per fixture file) as an integration test before running; build a sample `components/` folder with realistic good/bad CSS; run the plugin end-to-end via stylelint CLI.
- Fuzz-ish pass: weird selectors (`:is()`, attribute selectors, multiple classes) must not crash or false-positive.
- Fix findings; final review.

**Acceptance:** end-to-end run matches expected violations exactly.

---

## Handoff

**Purpose of this section:** allow a fresh session/model to resume with zero prior chat context.

- **Read first:** `AGENTS.md` (root) → `PRODUCT.md`, `CHECKS.md`, `README.md`, `STACK.md`, `docs/bem.md` → this file. The root docs are durable and outlive this plan — behavior questions are answered by `CHECKS.md`, usage/options by `README.md`, tech questions by `STACK.md`; this plan holds only sequencing, status, and decision history. If this plan conflicts with the root docs, the root docs win (and flag the conflict).
- **Source of truth for decisions:** the table above. Do not re-interview; ask only about genuinely new ambiguities.
- **Current status:** _Phase 1 complete (2026-07-21), **not yet reviewed/approved by Jeremy** — a real-world dogfood test surfaced an open question about the orphan-scope decision (see below) that's worth resolving before starting Phase 2. Single-rule plugin (`plugin/stylelint-bem`, all checks opt-out via its `checks` option) — see the Phase 1 bullet below for the full shape. Docs also split this session: `RULES.md` → `CHECKS.md` (pure check list) + new `README.md` (install/usage/options); every cross-reference across `AGENTS.md`/`PRODUCT.md`/`STACK.md`/this file was updated to match._ ← update this line as phases complete (e.g. "Phase 2 complete, awaiting review", plus any review adjustments as bullet notes under the phase).
  - **Reversed the earlier "defer wiring to Phase 4" call.** `src/index.ts` aggregates the rule plugin(s) as they land, and `src/configs/recommended.ts` enables them — both are kept live from here on, not batched into Phase 4. (Written when there were two rule plugins; still true now that there's one — see the single-rule redesign bullet below.) Reasoning: leaving them as empty stubs meant the package didn't do anything end-to-end for two more phases, which is exactly what caused confusion when reviewing Phase 1. Verified for real, not just via the internal test harness: built with `npm run build` and ran the actual `stylelint` CLI against a sample file using `dist/configs/recommended.js` — well-formed BEM passed clean, orphaned classes were caught with the expected messages.
  - **Phase 0:**
    - Build tool: **tsup** (chosen at scaffold time — ESM + `.d.ts` output with minimal config).
    - Scaffolded: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`.
    - Shared core implemented with red→green TDD: `src/utils/bem-parser.ts` (`parseClassName`, `isKebabCase`), `src/utils/selector-walker.ts` (`getClassNames`, `getClassNodes`), `src/utils/block-index.ts` (`buildBlockIndex`). (`parseClassName` renamed from `parseBemClassName` per review — the module name already says "bem".)
    - `src/index.ts` and `src/configs/recommended.ts` started as empty structural stubs in Phase 0 (no rules existed yet, so nothing to wire up). Superseded in Phase 1 — see below.
    - `buildBlockIndex` only registers a block when a rule's selector is a **single**, non-BEM class (e.g. `.card`); compound multi-class selectors (`.card.dark`) are not indexed — a deliberately conservative default that Phase 1 kept as-is (no fixture needed it loosened).
    - Not yet a git repository — no `git init` was run since it wasn't part of the Phase 0 scope; flag if you want that set up.
  - **Phase 1 (final state — superseded intermediate drafts of this log have been collapsed; see git history if you need the blow-by-blow):**
    - One rule, `plugin/stylelint-bem` (`src/rules/stylelint-bem/index.ts`), primary option is either `true` or an options object (mirrors `stylelint-selector-bem-pattern`'s style, no `[primary, secondary]` tuple). Reason it's one rule and not one-per-check: stylelint's `lintPostcssResult.mjs` only ever runs a rule that's a key in `config.rules` — `plugins` alone never activates anything, so per-check rules are inherently opt-in. Folding checks into one rule's options (all defaulting to `true`) makes them opt-out instead: a check runs unless its `checks.<name>` key is explicitly `false`.
    - Two checks implemented so far, as pure functions in `src/rules/stylelint-bem/checks/`: `checkNoOrphanedElement`, `checkNoOrphanedModifier`, each taking `(root, context: CheckContext)` (`check-context.ts`) — no `validateOptions`/`createPlugin`/messages of their own; the rule owns all of that once.
    - **Check semantics:** `noOrphanedElement` fires when `segments[0].separator === 'element'` and checks the root block is defined (`buildDefinedClassIndex`). `noOrphanedModifier` fires when the **last** segment is `modifier` and checks the modifier's *immediate target* is defined — the class name with the trailing modifier stripped (`formatClassName(block, segments.slice(0, -1), options)`). So `.card__title--large` is checked by **both**: element check requires `.card`, modifier check requires `.card__title` — independent problems, independent messages. `.card--featured__title` (modifier-then-element, invalid — a modifier can't have an element after it) is checked by **neither**; that shape is entirely `noDoubleNestedElement`'s job in Phase 2.
    - `buildDefinedClassIndex` (`block-index.ts`) indexes any rule whose selector is a **single** class, BEM-shaped or not; `buildBlockIndex` is a BEM-filtered view over it (kept for anywhere that specifically wants "block names only"). Compound multi-class selectors (`.card.dark`) are never indexed.
    - `ignoreSelectors` matches each individual selector in a rule's selector list (not the whole comma-separated group, not just the class name) — string entries need an exact match, regex entries use `.test()`.
    - Warning position uses `postcss-selector-parser`'s `sourceIndex` (via `getClassNodes`) as `index`/`endIndex` to `stylelint.utils.report`, matching the convention stylelint's own core rules use (e.g. `selector-class-pattern`).
    - Primary-option validation is two `validateOptions` calls: one checking `primary === true || isPlainObject(primary)`, then (if an object) one checking its keys against `{ ...sharedOptionsSchema, checks: [isChecksOption] }` — `isChecksOption` is a custom predicate validating the whole nested `checks` object at once, since stylelint's schema mechanism validates one level of keys against predicate arrays and doesn't recurse.
    - `rule-options.ts` exports `BemSharedOptions`/`sharedOptionsSchema` (elementSeparator/modifierSeparator/ignoreSelectors) plus `isString`/`isRegExp`, so the rule can extend the schema with its own `checks` key.
    - Test layout: `src/rules/stylelint-bem/checks/*.test.ts` test each check in isolation by disabling its sibling (`checks: { noOrphanedModifier: false }`, etc.) — both checks report under the same `ruleName`, and `testRule`'s harness filters warnings by rule name only, so isolation has to happen via config, not filtering. `src/rules/stylelint-bem/index.test.ts` covers the rule itself: default opt-out, disabling one check leaves the other running, and the overlap scenario (`.card {} .card__title--large {}` → exactly one warning, from the modifier check).
    - `src/index.ts` exports `[stylelintBem]`; `src/configs/recommended.ts` sets `plugin/stylelint-bem: true`.
    - Test count: 87, all green. `tsc --noEmit` and `npm run build` clean.
  - **Real-world dogfood against an external Rails project (2026-07-21, ahead of Phase 5 — worth doing early since it challenges a Phase-1-and-earlier decision):**
    - Method: no dependency was added to the target project — `npm link` was tried first but hit a pre-existing, unrelated `ERESOLVE` conflict in that project's own tree (`eslint@10` vs. `eslint-plugin-jsdoc`'s `eslint@9` peer requirement), and separately the project turned out to be Yarn Berry (`yarn@4.10.3`, `node-modules` linker) rather than npm, so `npm link`/`npm unlink` was abandoned entirely (global link removed after). Instead: built (`npm run build`), then ran the target project's own installed `stylelint` CLI with an ad-hoc `--config` file (in the scratchpad, not committed anywhere) whose `plugins` array pointed straight at this repo's `dist/index.js` by absolute path. Zero changes to the target project — confirmed clean via `git status --short` before and after.
    - **stylelint version — resolved:** the target project runs stylelint **17.10.0**; ran correctly with no errors. Jeremy confirmed widening `peerDependencies` to `^16.0.0 || ^17.0.0` on this evidence (done — see `package.json`/`STACK.md`). Still not cross-checked against stylelint's actual 16→17 changelog; if a real incompatibility ever surfaces, narrow it back.
    - **The big finding:** ran against all of `app/assets/stylesheets/components/**/*.css` (a real, mature Optics-design-system-based Rails app) with only the two Phase 1 checks on. Got 23 orphan findings. Traced every single one back to its block definition — **100% of them were cross-file BEM**: the block is defined once in a shared/design-system file (e.g. `.btn` in `components/optics-overrides/button.css`, `.card` in `components/optics-overrides/card.css`, `.accordion`/`.text-pair` under `shared/components/optics-overrides/`), and a *different* page/feature file adds a modifier or element onto it (e.g. `.btn--jumbo` in `kiosk.css`, `.card__header` in `booking.css`). None were genuine same-file BEM mistakes. There was also a `.react-select__dropdown`/`.react-select__indicator` case — third-party vendor classes (the `react-select` npm package's own DOM classes), which will **always** false-positive under any same-file scope since their "block" isn't authored by this team at all.
    - **Orphan scope — resolved, not yet implemented:** Jeremy chose **project-wide** scope over keeping same-file-only or adding a "shared directories" config option. **This is the next task.** Open implementation questions to work through before writing tests:
      - stylelint calls a rule's `(root, result)` function once per file, with only that file's AST — there is no "all files in this run" hook in the public plugin API. The current per-file `buildDefinedClassIndex(root)` call inside the rule (`src/rules/stylelint-bem/index.ts`) has nothing to build a project-wide index *from*.
      - Likely approach: the plugin does its own file discovery (glob) and parses matched files directly with `postcss.parse()` (already a dependency) to build a combined index, independent of whatever subset of files stylelint happens to be linting in this invocation. Needs: a way to know the project root / which files to scan (an explicit option? infer from cwd? from the file currently being linted, walking upward?), and a new glob dependency (e.g. `fast-glob`) — check whether one is already transitively available before adding it.
      - Performance: naively re-scanning every project file on every single file stylelint lints would be slow on a large codebase (this would happen once per file linted, not once per run). Needs a cache keyed on something stable across the run (module-level cache is the obvious first idea, but confirm it's safe under stylelint's actual execution model — e.g. does it ever run rule modules in fresh workers per file, which would defeat a module-level cache?).
      - Decide whether "project-wide" means "every file matching a glob on disk" (works even if stylelint is only linting one file) vs. "every file in this particular stylelint invocation" (would require a different mechanism, likely a stylelint `Processor` or similar — more fragile, possibly not achievable in the current plugin architecture). The dogfood test's mental model was the former (scan the whole `components/` tree), so start there.
      - This changes `CHECKS.md`'s wording too ("is defined in the same file" → "is defined in the project") once implemented, and likely needs a new rule option (e.g. something like `stylelint-selector-bem-pattern`'s `implicitComponents` glob, which is precedent for exactly this kind of file-discovery option).
- **Known quirks:**
  - `docs/bem.md` is an external team resource — do not modify; its dead link to `ui-building-guide.md` is intentional.
  - This became a real git repo at some point during Phase 0/1 outside of any session's visible actions (never `git init`/`git commit` run by an assistant per the user's standing rule to only commit when told to in the moment) — as of this handoff there are 4 commits on `main` (`0619a51` init → `2ebca6d` phase 0 → `187068a` phase 1 pre-redesign → `315983f` "Functioning state"), working tree clean. Likely Jeremy committing directly; not investigated further since it's not causing any problem, just noting it so a fresh session isn't surprised to find commits it doesn't remember making.
- **Workflow contract:** strict TDD per the "TDD workflow" section — tests first, confirm red, implement to green. Complete one phase, then STOP and ask Jeremy for review before starting the next. Review adjustments start as new failing tests; record them in this file, then proceed.
- **Repo layout (once scaffolded):** `src/rules/stylelint-bem/index.ts` (the one rule: option validation + dispatch), `src/rules/stylelint-bem/checks/<check-name>.ts` (one file per check, + its tests), `src/utils/` (parser, walker, block/defined-class index), `src/index.ts` (plugin export), `src/configs/recommended.ts`.
- **Run:** `npm test` (Vitest), `npm run build`.
- **Open items:**
  - decide `@media` semantics at Phase 3
  - finalize build tool (tsup vs tsc) at Phase 0 — done, tsup
  - finalize versioning (changesets vs manual) at Phase 4
  - **next task, decided 2026-07-21 from the real-project dogfood:** implement project-wide orphan scope (was same-file-only). See the "Orphan scope — resolved, not yet implemented" bullet under Phase 1 for the open implementation questions to work through first (file discovery mechanism, caching, whether a new option/dependency is needed). Do this before Phase 2, or at least before building more checks on top of the current per-file-only index.
- **Rule/check count check:** **one rule**, `plugin/stylelint-bem`, with **five checks** under its `checks` option — `validName`, `noOrphanedElement`, `noOrphanedModifier`, `noDoubleNestedElement`, `requireNesting`. All default `true` (opt-out). If `CHECKS.md` lists more/fewer, it has been updated since; follow it. (Superseded the earlier "five separate rules" design 2026-07-21 — see the Decisions table.)
