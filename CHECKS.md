# stylelint-bem — Checks

Central list of checks this plugin runs, and their semantics. Other documents should link here rather than duplicating check details. For how to install, enable, and configure the plugin (options, toggling checks, presets), see `README.md`.

**Shared grammar:** valid block, element, and modifier names are kebab-case (lowercase letters/digits separated by single dashes). Dashes within a part name are normal; only the configured separators carry structural meaning. A class using BEM separators with a non-kebab-case part is invalid BEM and is flagged by the `validName` check. Methodology background: `docs/bem.md`.

## `validName`

Every part (block, element, modifier) of a BEM class must be kebab-case: lowercase letters/digits separated by single dashes.

```css
/* invalid — parts are not kebab-case */
.myBlock--active { }
.card__Title { }

/* valid (assuming .my-block is defined) */
.my-block--active { }
```

## `noOrphanedElement`

`.block__thing` is only valid if `.block` is defined somewhere in the project — the current file, or any other CSS file under the project root (the nearest directory containing a `package.json`, walking up from the linted file; `node_modules` and symlinks are never scanned). A block name listed in `knownBlocks` is always treated as defined, for classes that come from a third-party dependency and are never defined in any project CSS file.

```css
/* invalid — .card is never defined anywhere in the project */
.card__title { }
```

## `noOrphanedModifier`

`.block--thing` is only valid if `.block` is defined somewhere in the project (see `noOrphanedElement` for what "in the project" means). When the modifier applies to an element instead (`.block__element--thing`), its immediate target — `.block__element` — must be defined somewhere in the project; the root block is checked independently by `noOrphanedElement`. As with `noOrphanedElement`, a `knownBlocks` entry for the root block satisfies both checks.

```css
/* invalid — .card is never defined anywhere in the project */
.card--featured { }

/* invalid — .card__title is never defined anywhere in the project, even though .card is */
.card { }
.card__title--large { }
```

## `noDoubleNestedElement`

BEM has one element level. `.block__element__other` is invalid — flatten to `.block__other`. Elements on modifiers (`.block--mod__el`) are also invalid, since a modifier cannot be followed by an element. Modifiers on elements (`.block__el--mod`) are valid.

```css
/* invalid */
.card__header__title { }
.card--featured__title { }

/* valid */
.card__title--large { }
```

## `requireNesting`

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
