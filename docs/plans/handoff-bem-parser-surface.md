# Handoff — stylelint-bem: execute the `bem-parser` surface plan

**Repo:** `/Users/jeremywalton/Workspace/stylelint-bem`
**Date:** 2026-07-24
**Focus for next session:** execute the captured plan at `docs/plans/bem-parser-surface.md` — but its headline item has an unresolved fork that must be decided *with the user* first (see below).

## Primary artifact — read this first

`docs/plans/bem-parser-surface.md` is the deliverable and single source of truth for the work. It already contains: the current surface, a **caller map** (who calls each `bem-parser` export), three ranked opportunities, and the open decisions. **Do not re-derive any of that** — read the plan. This handoff only adds conversation context the plan doesn't carry.

## What this session did (context, not action items)

1. Ran a whole-codebase depth survey using the `codebase-design` deep-module vocabulary (deep modules = lots of behaviour behind a small interface at a clean seam).
2. Implemented "Variant A" — reshaped `selector-walker`'s `ClassNode` chain-root from a 4-way sentinel (`chainRootHasAmpersand`/`chainRootClassNames`) into a `chainRoot` discriminated union (`{kind:'ampersand'|'classless'|'classes', names?}`). Sole consumer was `require-nesting`. Done via `/tdd` (real red step at the walker seam).
3. Deepened `require-nesting` internals in 3 phases (its own plan, now **completed and deleted**): (A) moved `blockOf`+`isModifierOf` to `bem-parser` with 9 new unit tests; (B) introduced a `NestingCheck` context object to kill an orchestration data-clump; (C) decomposed the 95-line `checkElementNesting` into `isValidElementShape` + `reportInvalidElementShape` + a slim orchestrator.
4. Zoomed into `bem-parser` and captured the plan above — **analysis only, no code written.**

## Current repo state — IMPORTANT

- **All green as of now:** 303 tests passing (was 294 + 9 new `bem-parser` tests), `npm run typecheck` clean.
- **Working tree holds TWO uncommitted logical changes** (the user commits their own work, per-component — nothing here has been committed):
  - *chainRoot reshape* → `src/utils/selector-walker.ts`, `tests/utils/selector-walker.test.ts`
  - *require-nesting deepening* → `src/utils/bem-parser.ts`, `src/rules/require-nesting/index.ts`, `tests/utils/bem-parser.test.ts`
  - They split cleanly along those file lines if committed separately.
- New untracked: `docs/plans/bem-parser-surface.md` (the plan).
- Pre-existing/unrelated (dirty since session start, not ours): `skills-lock.json`, `.agents/skills/*`.

## The actual work for next session

Execute `bem-parser-surface.md`. Before writing code:

1. **Resolve Opportunity 1's fork WITH the user** (it's flagged design-it-twice). The fork: bind `BemSeparatorOptions` once via a `naming` façade on `RuleContext` vs. keep the current free-functions-with-explicit-params style. Sub-options (a) full façade, (b) lighter `context.naming` sugar keeping free primitives, (c) do nothing. **Large blast radius** (rule-context + all 4 rules + require-nesting internals + direct bem-parser tests). Do not just pick one and build — surface the trade-off first.
2. **Opportunity 2 is independent and low-risk** (give `formatClassName` a `ParsedBemClassName` form; non-breaking overload, 2 callers). It can land first regardless of the #1 decision — a reasonable warm-up.
3. **Opportunity 3 is no-action** (documented so it isn't re-litigated).

## Constraints & decisions carried from this session

- **Strict TDD** (AGENTS.md): tests first, watch them fail for the right reason, then implement. Only steps with genuinely new observable behaviour get a red→green cycle; pure refactors ride the existing test net (that's how phases B/C above were done — no new tests).
- **Never commit** unless the user says "commit" in the moment. At wrap-up, list uncommitted files instead.
- **The user applies review findings individually** — expect only some of any batch to survive; reverting part is normal. Present options, recommend, let them choose (interview/one-question-at-a-time style).
- **Behavioural pattern observed:** across this session the user consistently favoured the smaller-surface / less-machinery choice and "code is right, docs move." That's relevant to the Opportunity-1 fork — they may well lean toward (b) or (c) over a full façade. Don't assume; ask.
- The free-function convention is real and uniform across the codebase — a bound `naming` object is a deliberate departure, which is exactly why #1 needs a decision.

## Suggested skills for next session

- **`codebase-design`** — the deep-module vocabulary the plan is written in (module/interface/seam/depth/leverage). Load it before reasoning about the façade shape; its `DESIGN-IT-TWICE.md` is the method for the Opportunity-1 fork.
- **`grill-me`** — to pin the Opportunity-1 fork with the user before any code, one question at a time (the pattern used repeatedly this session).
- **`tdd`** — for execution once an approach is chosen.

## Not covered / do not assume done

- No implementation of `bem-parser-surface.md` has started.
- The two uncommitted changes (chainRoot, require-nesting deepening) are **not committed** — don't assume they're landed.
- No sensitive data in scope; nothing redacted.
