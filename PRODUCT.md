# stylelint-bem — Product

## Premise

CSS written with BEM methodology degrades quietly. Elements get defined without their block, modifiers float free of anything they modify, and names drift into invalid shapes like `block__element__other`. Nothing breaks visually, so nothing gets caught — until the codebase is full of BEM-shaped classes that no longer follow BEM.

`stylelint-bem` is a stylelint plugin that enforces BEM validity automatically, as part of linting, so these problems are caught at write time instead of review time (or never).

## What it checks

The plugin treats native CSS nesting as the mechanism that keeps BEM honest: a block's elements and modifiers should live *inside* the block's rule, so they can't apply outside their intended block. Around that idea, it enforces nesting structure, catches orphaned elements and modifiers whose block was never defined, and rejects invalid name shapes like double-nested elements.

The full check list and semantics live in `CHECKS.md`. More checks may follow.

## What it deliberately doesn't do

- **It doesn't police every selector.** Only class names that are *trying* to be BEM (they use BEM separators) are checked. Utility classes, global styles, and third-party overrides are left alone.
- **It doesn't rewrite your code.** Rules report problems; restructuring is the author's call.
- **It doesn't impose one dialect.** Separators and other conventions are configurable to fit a team's flavor of BEM.

## Who it's for

Teams and individuals using BEM for component CSS who want the convention enforced by tooling rather than memory and code review. It plugs into an existing stylelint setup — each rule can be enabled individually, or a recommended preset turns on everything with sane defaults.
