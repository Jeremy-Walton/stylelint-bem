# stylelint-bem

A stylelint plugin that validates BEM methodology in CSS written with native nesting. See `PRODUCT.md` for what this plugin is and why, and `CHECKS.md` for the full list of checks it runs.

## Usage

The plugin exposes a **single** stylelint rule, `plugin/stylelint-bem`, that runs a fixed set of BEM checks.

```json
{
  "plugin/stylelint-bem": true
}
```

Enabling the rule — with `true`, or with an options object — turns **all** checks on by default (opt-out). Disable an individual check by setting its key to `false` under `checks`; you don't need to enable checks explicitly.

```json
{
  "plugin/stylelint-bem": {
    "checks": {
      "noOrphanedModifier": false
    }
  }
}
```

## Options

The rule's primary option is either `true` or an object:

| Option | Type | Default | Description |
|---|---|---|---|
| `elementSeparator` | `string` | `__` | Separator marking an element |
| `modifierSeparator` | `string` | `--` | Separator marking a modifier |
| `ignoreSelectors` | `(string \| RegExp)[]` | `[]` | Selectors to skip entirely. String entries match exactly; `RegExp` entries use `.test()`. |
| `knownBlocks` | `string[]` | `[]` | Block names always treated as defined, wherever they appear — for third-party/vendor classes (e.g. a component library's own DOM classes) that will never be defined in any project CSS file. |
| `checks` | `object` | all `true` | Per-check on/off switches — see `CHECKS.md` for the full list. Only keys for checks you want to turn **off** need to be present. |

Only class names using the configured separators are checked — non-BEM selectors are never flagged. No check provides autofix.

The orphan checks (`noOrphanedElement`, `noOrphanedModifier`) look for a block's definition across the whole project, not just the file being linted — see `CHECKS.md` for how the project root is determined.

## Presets

- **recommended** — enables `plugin/stylelint-bem` with all checks on (equivalent to `true`).
