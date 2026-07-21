# stylelint-bem — Rules

Central list of rules. Other documents should link here rather than duplicating rule details.

All rules share these secondary options: `elementSeparator` (default `__`), `modifierSeparator` (default `--`), `ignoreSelectors`. Only class names using the configured separators are checked — non-BEM selectors are never flagged. No rule provides autofix.

**Shared grammar:** valid block, element, and modifier names are kebab-case (lowercase letters/digits with single dashes). Dashes within a part name are normal; only the configured separators carry structural meaning. A class using BEM separators with a non-kebab-case part is invalid BEM and is flagged by `valid-name`. Methodology background: `docs/bem.md`.

## `plugin/stylelint-bem-valid-name`

Every part (block, element, modifier) of a BEM class must be kebab-case: lowercase letters/digits separated by single dashes.

```css
/* invalid — parts are not kebab-case */
.myBlock--active { }
.card__Title { }

/* valid (assuming .my-block is defined) */
.my-block--active { }
```

## `plugin/stylelint-bem-no-orphaned-element`

`.block__thing` is only valid if `.block` is defined in the same file.

```css
/* invalid — .card is never defined */
.card__title { }
```

## `plugin/stylelint-bem-no-orphaned-modifier`

`.block--thing` is only valid if `.block` is defined in the same file.

```css
/* invalid — .card is never defined */
.card--featured { }
```

## `plugin/stylelint-bem-no-double-nested-element`

BEM has one element level. `.block__element__other` is invalid — flatten to `.block__other`. Elements on modifiers (`.block--mod__el`) are also invalid. Modifiers on elements (`.block__el--mod`) are valid.

```css
/* invalid */
.card__header__title { }
.card--featured__title { }

/* valid */
.card__title--large { }
```

## `plugin/stylelint-bem-require-nesting`

Elements and modifiers must be defined inside their block's rule via native CSS nesting, so they can't apply outside their intended block.

- Elements: full selector nested (at any depth) inside the block rule — `.block { .block__el { } }`. No `&__el` concatenation shorthand.
- Modifiers: compound `&` selector directly under what they modify — `.block { &.block--mod { } }`.
- Element modifiers: `&.block__el--mod` under `.block__el`, which is itself nested in `.block`.

```css
/* valid */
.card {
  .card__title {
    &.card__title--large { }
  }
  &.card--featured { }
}

/* invalid — element defined at top level */
.card { }
.card__title { }
```

## Presets

- **recommended** — enables all rules with default options.
