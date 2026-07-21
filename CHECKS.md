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

`.block__thing` is only valid if `.block` is defined somewhere in the project — the current file, or any other `.css`/`.scss` file under the project root (the nearest directory containing a `package.json`, walking up from the linted file; `node_modules` and symlinks are never scanned). If no `package.json` is found anywhere above the linted file, the check falls back to same-file-only (it never errors, and never scans from some other guessed root). A block name listed in `knownBlocks` is always treated as defined, for classes that come from a third-party dependency and are never defined in any project CSS/SCSS file.

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

Elements and modifiers must be defined inside their block's rule via native CSS nesting, so they can't apply outside their intended block.

- Elements: full selector nested (at any depth) inside the block rule — `.block { .block__el { } }`. No `&__el` concatenation shorthand. The element may carry its own modifiers in the same compound (`.block__el.block__el--mod`), and a `.block.block--mod` compound rule counts as the block rule for nesting purposes.
- Modifiers: paired with what they modify — either a compound `&` selector directly under it (`.block { &.block--mod { } }`), or compounded directly with it in one selector (`.block.block--mod { }`). Both are equivalent: the modifier can never apply without its target. The direct-compound form needs no ancestor at all, so it's valid at the top level, even in `strict` mode.
- Element modifiers: same two forms — `&.block__el--mod` under `.block__el` (itself nested in `.block`), or `.block__el.block__el--mod` (the element part still needs its block nesting).

Classes inside the arguments of a filtering pseudo-class — `:has()`, `:not()`, `:nth-child(… of S)`, `:nth-last-child(… of S)` — are match conditions on the subject, never the element being styled, so this check ignores them entirely (e.g. `&:has(> .form-group--full-width)` is fine anywhere) and never counts them as a block definition to nest under. `:is()`/`:where()` arguments form the subject itself and are checked as normal.

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

/* invalid — element defined at top level */
.card { }
.card__title { }
```

### Strictness: `strict` / `weak`

Unlike the other rules, `stylelint-bem/require-nesting`'s primary option takes more than a boolean — it accepts `true` (equivalent to `"strict"`), `"strict"`, or `"weak"`. (To disable the rule entirely, omit it from your config or set it to `false` at the top level, same as any stylelint rule.)

By construction, `requireNesting` can only ever validate nesting within the *current file's* AST — it has no way to confirm nesting against a block defined in a different file, even though that block is a legitimate, fully-defined part of the project (see `noOrphanedElement`). This makes **`strict`** mode (the default) incompatible with a common, legitimate pattern: a shared component's block lives in one file, and a page/feature file customizes it with a modifier or element written flat, without re-declaring the block's nesting:

```css
/* shared/button.css */
.btn {
  &.btn--large { }
}

/* pages/dashboard.css — customizing .btn from a different file */
.btn--jumbo { }
```

Under `strict`, `.btn--jumbo` is flagged (`.btn` isn't nested in *this* file, so there's nothing to compound `&` against). **`weak`** mode only validates nesting when it's actually attempted — a class with no ancestor rule at all is left unchecked, which allows the pattern above while still catching genuine mistakes (a class nested under the *wrong* ancestor, or nested but with the wrong shape, is still flagged either way). **`false`** disables the check entirely.

```json
{
  "stylelint-bem/require-nesting": "weak"
}
```
