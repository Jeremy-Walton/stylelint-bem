# Design capture — `bem-parser` surface

**Status:** captured, **not scheduled**. Analysis only — no code to be written until an approach is chosen (Opportunity 1 has a genuine fork; see Open decisions).
**Origin:** whole-codebase depth survey → "zoom into the bem-parser surface."
**Scope of file:** `src/utils/bem-parser.ts` (122 lines) — BEM class-name algebra: parse, format, relationships, validity.

## Current surface

11 exported symbols: 4 types (`BemSeparatorOptions`, `BemSegmentSeparator`, `BemSegment`, `ParsedBemClassName`) + 7 functions. The deep heart is `parseClassName` (string → structured `ParsedBemClassName`); the rest are format/relationship/accessor helpers around it.

### Caller map (src, excl. tests)

| Export | Input shape | Callers |
|---|---|---|
| `parseClassName(className, options)` | string | `rule-context` **(1)** — the sole parse site; feeds `parsed` to every rule visitor |
| `formatClassName(block, segments, options)` | decomposed | `no-double-nested`, `require-nesting` (2) |
| `parentClassName(parsed, options)` | parsed | `no-orphaned-modifier`, `require-nesting` (2) |
| `lastSegment(parsed)` | parsed | `no-double-nested`, `no-orphaned-modifier`, `require-nesting` (3) |
| `blockOf(className, options)` | string | `require-nesting` (3) |
| `isModifierOf(className, parentName, options)` | string | `require-nesting` (2) |
| `isKebabCase(name)` | plain string | `valid-name` (2) |

## Smells (deep-module lens)

1. **`BemSeparatorOptions` is a data clump threaded everywhere.** 5 of 7 functions take `options`; every rule re-passes `context.separatorOptions` per call, and `require-nesting` threads `separatorOptions` through ~6 internal predicates (`isLegitimateChain`, `ruleDefinesClass`, `isSameBlockCompound`, `isPureAmpersandModifierCompoundOf`, `isDirectlyNestedUnderTarget`, and the removed-from-here name helpers). Same shape as the `NestingCheck` clump just fixed in `require-nesting`, but one layer down and cross-cutting.
2. **The module speaks two dialects.** Some functions take a raw `className` string (`parseClassName`, `blockOf`, `isModifierOf`), others a `ParsedBemClassName` (`lastSegment`, `parentClassName`), and `formatClassName` takes decomposed `(block, segments)` — even though `ParsedBemClassName` already *is* `{ block, segments }`. Callers translate between representations by hand.
3. **Leaf assessment (mostly benign).** `isKebabCase` is a BEM-agnostic regex predicate; `lastSegment` is a one-line accessor; `blockOf` is a one-line `parseClassName(x).block` shortcut. Named vocabulary, low depth — flag, don't churn.

## Opportunities (ranked)

### 1. Bind `BemSeparatorOptions` once — a `naming` façade *(headline; design-it-twice candidate)*
Build one options-bound vocabulary and stop threading `options`. Candidate: `bemNaming(options)` → `{ parse, format, blockOf, isModifierOf, parentClassName, lastSegment }`, created once where `separatorOptions` is resolved (`rule-context`) and exposed on `RuleContext` (e.g. `context.naming`). Rules and `require-nesting`'s predicates use the bound calls.
- **Leverage:** drops the `options` argument from ~10 rule call sites and lets `require-nesting`'s predicate signatures shed `separatorOptions`.
- **Blast radius:** LARGE — `rule-context` (build + expose), all 4 rule files, `require-nesting` internals, and the direct unit tests in `bem-parser.test.ts` (which call the free functions with `defaultOptions`).
- **Deletion test:** the façade earns its keep only if it removes real repetition across N callers — it does (options threaded ~15×). But see the fork below.

### 2. Unify the two input representations *(modest, independent)*
Give `formatClassName` a `ParsedBemClassName` form (additive overload — `parentClassName` already builds from a parsed object), and treat `ParsedBemClassName` as the spine so string-in helpers read as explicit "parse-and-X" shortcuts.
- **Leverage:** removes the "which dialect does this want?" burden; `format(parsed)` is more cohesive than passing `block` + `segments` separately.
- **Blast radius:** SMALL — `formatClassName` has 2 callers; an overload is non-breaking.

### 3. Leaf/placement — no action
`isKebabCase` (keep here as the shared-grammar name-shape rule), `lastSegment`, `blockOf` — documented so a future reviewer doesn't re-litigate. Optional: the file is now name *algebra*, not just a parser — a rename to `bem-names` is available but low-value/high-churn (imports + `@src` aliases). Flag only.

## Open decisions (resolve before scheduling)

- **Opportunity 1 fork: bound façade vs. keep free functions.** The codebase is uniformly free-functions-with-explicit-params — no stateful helpers anywhere. A `naming` object is a mild departure. Sub-options:
  - (a) Full façade on `RuleContext` (biggest leverage, biggest change, style departure).
  - (b) Lighter: add `context.naming` sugar but keep the free functions as the tested primitives (façade delegates) — smaller risk, some duplication.
  - (c) Do nothing — accept the options threading as explicit-and-simple.
  Recommend **design-it-twice** (draft (a) and (b), compare on depth vs. churn) before committing.
- **Sequence vs. Opportunity 2:** #2 is independent and low-risk; it could land first regardless of the #1 decision.

## Explicitly out of scope here
- Any implementation. This document is a capture; scheduling happens after the Opportunity-1 fork is decided.
