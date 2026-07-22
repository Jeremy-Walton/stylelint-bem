# stylelint-bem — Checks

Central list of checks this plugin runs, and their semantics. Other documents should link here rather than duplicating check details. For how to install, enable, and configure the plugin (options, toggling checks, presets), see `README.md`.

**Shared grammar:** valid block, element, and modifier names are kebab-case (lowercase letters/digits separated by single dashes). Dashes within a part name are normal; only the configured separators carry structural meaning. A class using BEM separators with a non-kebab-case part is invalid BEM and is flagged by the `stylelint-bem/valid-name` rule. Methodology background: `docs/bem.md`.

## `stylelint-bem/valid-name`

Every part (block, element, modifier) of a BEM class must be kebab-case: lowercase letters/digits separated by single dashes.

```css
/* invalid — parts are not kebab-case */
.myBlock--active { }
.card__Title { }

/* valid (assuming .my-block is defined) */
.my-block--active { }
```

## `stylelint-bem/no-orphaned-element`

`.block__thing` is only valid if `.block` is defined somewhere in the project — the current file, or any other `.css`/`.scss` file under the project root (the nearest directory containing a `package.json`, walking up from the linted file; `node_modules`, `vendor` directories, and symlinks are never scanned). If no `package.json` is found anywhere above the linted file, the check falls back to same-file-only (it never errors, and never scans from some other guessed root). A block name listed in `knownBlocks` is always treated as defined, for classes that come from a third-party dependency and are never defined in any project CSS/SCSS file.

```css
/* invalid — .card is never defined anywhere in the project */
.card__title { }
```

## `stylelint-bem/no-orphaned-modifier`

`.block--thing` is only valid if `.block` is defined somewhere in the project (see `noOrphanedElement` for what "in the project" means). When the modifier applies to an element instead (`.block__element--thing`), its immediate target — `.block__element` — must be defined somewhere in the project; the root block is checked independently by `noOrphanedElement`. As with `noOrphanedElement`, a `knownBlocks` entry for the root block satisfies both checks.

```css
/* invalid — .card is never defined anywhere in the project */
.card--featured { }

/* invalid — .card__title is never defined anywhere in the project, even though .card is */
.card { }
.card__title--large { }
```

## `stylelint-bem/no-double-nested-element`

BEM has one element level. `.block__element__other` is invalid — flatten to `.block__other`. Elements on modifiers (`.block--mod__el`) are also invalid, since a modifier cannot be followed by an element. Modifiers on elements (`.block__el--mod`) are valid.

```css
/* invalid */
.card__header__title { }
.card--featured__title { }

/* valid */
.card__title--large { }
```

## `stylelint-bem/require-nesting`

Elements and modifiers must be defined via native CSS nesting rather than written flat, and modifiers must always be paired with what they modify.

- Elements: full selector nested via native CSS nesting — never written flat at the top level. In `strict` mode the element must be nested (at any depth) inside its own block's rule — `.block { .block__el { } }`; a `.block.block--mod` compound rule counts as the block rule. In `weak` mode any ancestor rule counts (see Strictness below). No `&__el` concatenation shorthand, and no compound `&` shape — except one hop past a leading, clean root compound (classes, `&`, and/or pseudo-classes like `:first-child`/`:has(...)`, nothing else), e.g. `&.block--mod .block__el { }`, `.block .block__el { }`, or `.block__sibling:first-child .block__el { }`, which flattens what would otherwise be a level of native nesting into one selector and is treated the same way. A root using `&` is always trusted (it refers to whatever the real ancestor turns out to be, validated separately); a root written as literal classes must share the element's own **block** with at least one of its classes — the bare block itself (`.wrapper .block__el` does **not** count — `wrapper` isn't part of `block`'s family) or another element/modifier of the same block (`.block__sibling .block__el` counts too, e.g. two DOM-adjacent elements of one component) — and, being self-sufficient, satisfies the "nested" requirement even with zero real ancestor rules *when the root is the bare block itself* (e.g. a whole file that's just `.block .block__el { }` inside a transparent `@media`); a root that's itself a BEM element still needs its own real nesting or ancestor, same as any other element. An ampersand root always still needs a real ancestor for `&` to mean anything. The element may carry its own modifiers in the same compound (`.block__el.block__el--mod`, and likewise `.block .block__el.block__el--mod`).
- Modifiers: paired with what they modify — either a compound `&` selector directly under it (`.block { &.block--mod { } }`), or compounded directly with it in one selector (`.block.block--mod { }`). Both are equivalent: the modifier can never apply without its target. The direct-compound form needs no ancestor at all — and no legitimate root, either, since the pairing is complete on its own — so it's valid at the top level or behind an unrelated combinator prefix (`.wrapper .block.block--mod { }`), even in `strict` mode. A `.block.block--mod` compound rule counts as the target's rule for the `&` form. Two or more modifiers of the **same block** can also be compounded together directly with `&` — `&.block--mod1.block--mod2 { }` — since they're peers, not parent/child: each is independently and safely paired with whatever `&` resolves to, equivalent to `&.block--mod1 { &.block--mod2 { } }`. A sibling from a *different* block (`&.block--mod.other--mod`) is not a legitimate pairing and is still flagged.
- Element modifiers: same two forms — `&.block__el--mod` under `.block__el`, or `.block__el.block__el--mod` (the element part still needs to be nested somewhere itself, or reached via a legitimate chain as above).

Classes inside the arguments of a filtering pseudo-class — `:has()`, `:not()`, `:nth-child(… of S)`, `:nth-last-child(… of S)` — are match conditions on the subject, never the element being styled, so this check ignores them entirely (e.g. `&:has(> .field-group--full-width)` is fine anywhere) and never counts them as a block definition to nest under. `:is()`/`:where()` arguments form the subject itself and are checked as normal.

A tag, id, or universal selector compounded alongside a class — e.g. a custom element like `x-icon.block__el` — doesn't change anything: the class must still be present to match, exactly as if the tag/id/universal weren't there. It's ignored wherever a class's shape is judged, including as the leading node of a chain root (`x-icon.block:first-child .block__el { }` is a legitimate chain, same as `.block:first-child .block__el { }`).

`@media`/`@supports` (and other at-rules) are transparent for this check — they never count as a nesting level. A modifier compound-nested directly inside a `@media` that's itself directly inside its block still satisfies "directly under"; an element inside a `@media` at any depth inside its block still satisfies "at any depth".

```css
/* valid */
.card {
  .card__title {
    &.card__title--large { }
  }
  &.card--featured { }
}

/* valid — modifier compounded directly with its target */
.card.card--featured { }

/* valid — two modifiers of the same block compounded together via "&"; each is independently
   paired with the real ancestor .card */
.card {
  &.card--dark.card--featured { }
}

/* valid — element addressed via a chain off an ampersand-modifier compound, flattened into one
   selector; equivalent to `.card { &.card--ready { .card__title { } } }` */
.card {
  &.card--ready .card__title { }
}

/* valid — element addressed via a chain rooted in its own literal block name; self-sufficient,
   so this needs no wrapping `.card { }` rule at all, even in `strict` mode */
.card .card__title { }

/* valid — root is a sibling element of the same block (not the bare block), with a pseudo-class;
   the outer `.card { }` is required here since the root itself is a BEM element, not a bare block */
.card {
  .card__header:first-child .card__title { }
}

/* valid — a tag (here, a custom element) compounded with the element doesn't disqualify it */
.card {
  x-icon.card__icon { }
}

/* invalid — the root doesn't share .card__title's block, so this isn't a legitimate chain */
.wrapper .card__title { }

/* invalid — element defined at top level (both modes) */
.card { }
.card__title { }
```

### Strictness: `strict` / `weak`

Unlike the other rules, `stylelint-bem/require-nesting`'s primary option takes more than a boolean — it accepts `true` (equivalent to `"strict"`), `"strict"`, or `"weak"`. (To disable the rule entirely, omit it from your config or set it to `false` at the top level, same as any stylelint rule.)

By construction, `requireNesting` can only ever validate nesting within the *current file's* AST — it has no way to confirm nesting against a block defined in a different file, even though that block is a legitimate, fully-defined part of the project (see `noOrphanedElement`). The two modes only differ in what counts as valid nesting for an **element**:

- **`strict`** (the default): the element must be nested (at any depth) inside its **own block's** rule.
- **`weak`**: the element may be nested inside **any** rule, not just its own block — customizing another component's element from within a different component is deliberate scoping:

```css
/* valid in weak, flagged by strict */
.panel {
  .panel__header {
    .accordion__marker { }
  }
}
```

A flat element nested in nothing at all is flagged in **both** modes.

A **modifier**'s compounding requirement never relaxes between modes — it must always be either compounded directly with its target (`.block.block--mod { }`, valid with no ancestor at all, in both modes) or nested via `&` directly under the rule that defines its exact target. A shared component's block living in one file, customized with a flat modifier from a different page/feature file, is **not** a supported pattern — `requireNesting` can't confirm the block is nested correctly in that other file, so it has no basis to accept the modifier on faith:

```css
/* shared/button.css */
.btn {
  &.btn--large { }
}

/* pages/dashboard.css — customizing .btn from a different file */
.btn--jumbo { }        /* flagged in both modes — .btn isn't nested in *this* file */
.btn.btn--jumbo { }    /* valid in both modes — compounded directly, no ancestor needed */
```

Genuine mistakes (a modifier `&`-compounded under the wrong ancestor, or a class nested with the wrong shape) are still flagged either way. **`false`** disables the check entirely.

```json
{
  "stylelint-bem/require-nesting": "weak"
}
```
