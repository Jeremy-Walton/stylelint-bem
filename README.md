# stylelint-bem

A stylelint plugin that validates BEM methodology in CSS written with native nesting. See `PRODUCT.md` for what this plugin is and why, and `CHECKS.md` for the full list of checks it runs.

## Installation

```sh
npm install --save-dev @jeremywalton/stylelint-bem
```

Requires `stylelint` `^16.0.0` or `^17.0.0` as a peer dependency.

## Configuring the linter

The plugin ships five independent rules, one per check, each enabled and configured on its own:

- `stylelint-bem/valid-name`
- `stylelint-bem/no-orphaned-element`
- `stylelint-bem/no-orphaned-modifier`
- `stylelint-bem/no-double-nested-element`
- `stylelint-bem/require-nesting`

### Quick start

The fastest way to turn everything on with sensible defaults is to extend the recommended config in your
`.stylelintrc.json` (or equivalent):

```json
{
  "extends": ["@jeremywalton/stylelint-bem/config/recommended"]
}
```

This registers the plugin and enables the four BEM-correctness rules with their defaults — no separate
`plugins` entry needed. The fifth rule, `stylelint-bem/require-nesting`, is opt-in; see
[Enabling `require-nesting`](#enabling-require-nesting) and [Presets](#presets) below.

### Manual setup

To configure rules individually, register the plugin
yourself and list each rule under `rules`:

```json
{
  "plugins": ["@jeremywalton/stylelint-bem"],
  "rules": {
    "stylelint-bem/valid-name": true,
    "stylelint-bem/no-orphaned-element": true,
    "stylelint-bem/no-orphaned-modifier": true,
    "stylelint-bem/no-double-nested-element": true,
    "stylelint-bem/require-nesting": true
  }
}
```

Any subset of the five rules can be listed. Omit a rule to leave it off entirely. Each rule follows the
standard stylelint two-arg shape: a primary option (usually just `true`), and an optional secondary
options object for that rule's settings.

```json
{
  "plugins": ["@jeremywalton/stylelint-bem"],
  "rules": {
    "stylelint-bem/no-orphaned-element": [true, { "knownBlocks": ["react-select"] }],
    "stylelint-bem/require-nesting": ["weak", { "ignoreSelectors": [".js-*"] }]
  }
}
```

You can also start from the recommended config and layer overrides on top by extending it and then
re-declaring the rules you want to change under `rules` — `extends` and `rules` compose normally in
stylelint, with `rules` taking precedence.

### Enabling `require-nesting`

The recommended config leaves this rule off, because it's the only one that judges how a file is
organised rather than whether the CSS is valid BEM. Add it yourself to turn it on:

```json
{
  "extends": ["@jeremywalton/stylelint-bem/config/recommended"],
  "rules": {
    "stylelint-bem/require-nesting": true
  }
}
```

It requires elements to be nested and modifiers to be compounded with what they modify:

```css
/* valid */
.card {
  .card__title { }
  &.card--featured { }
}

/* flagged — valid BEM, but written flat */
.card { }
.card__title { }
.card--featured { }
```

The nested class is written out in full `.card__title`. SCSS-style `&__title` form is currently not supported.
Enable this rule if you want to enforce nesting and using full selectors `.card .card__title` or `.card.card--modifier`.Leave it off if you write flat BEM or use SCSS-style `&__title` form which is currently not supported
by this rule.

## Options

Secondary options shared by all five rules:

| Option | Type | Default | Description |
|---|---|---|---|
| `elementSeparator` | `string` | `__` | Separator marking an element |
| `modifierSeparator` | `string` | `--` | Separator marking a modifier |
| `ignoreSelectors` | `(string \| RegExp)[]` | `[]` | Selectors to skip entirely. String entries match exactly; `RegExp` entries use `.test()`. |

Additional secondary option, `stylelint-bem/no-orphaned-element` and `stylelint-bem/no-orphaned-modifier` only:

| Option | Type | Default | Description |
|---|---|---|---|
| `knownBlocks` | `string[]` | `[]` | Block names always treated as defined, wherever they appear — for third-party/vendor classes (e.g. a component library's own DOM classes) that will never be defined in any project CSS/SCSS file. |

`stylelint-bem/require-nesting`'s primary option is `true` (equivalent to `"strict"`), `"strict"`, or
`"weak"` — see `CHECKS.md` for what `weak` relaxes.

Only class names that participate in BEM are checked: those using the configured separators, plus a bare block name that a BEM element or modifier in the same file confirms is a block (see `CHECKS.md`). Genuinely non-BEM selectors — utility classes, globals, third-party overrides — are never flagged. No rule provides autofix.

`stylelint-bem/no-orphaned-element` and `stylelint-bem/no-orphaned-modifier` look for a block's definition across the whole project, not just the file being linted — see `CHECKS.md` for how the project root is determined.

## Presets

- **recommended** (`@jeremywalton/stylelint-bem/config/recommended`) — enables the four BEM-correctness
  rules (`valid-name`, `no-orphaned-element`, `no-orphaned-modifier`, `no-double-nested-element`) with
  their defaults. `require-nesting` is left off; see [Enabling `require-nesting`](#enabling-require-nesting).
  See [Quick start](#quick-start) above for how to extend it.
