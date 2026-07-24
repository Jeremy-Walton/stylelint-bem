# Changelog

All notable changes to this project are documented here. Versioning follows [Semantic Versioning](https://semver.org/).

## 0.1.0 - 2026-07-24

Initial release. A stylelint plugin that validates BEM methodology in CSS.

- Five independently-configurable rules:
  - `stylelint-bem/valid-name`
  - `stylelint-bem/no-orphaned-element`
  - `stylelint-bem/no-orphaned-modifier`
  - `stylelint-bem/no-double-nested-element`
  - `stylelint-bem/require-nesting`.
- Recommended shareable config (`stylelint-bem/config/recommended`) enabling all five rules with sensible defaults.
- Configurable `elementSeparator`/`modifierSeparator` and an `ignoreSelectors` escape hatch, shared across all rules.
- `knownBlocks` option on the orphan checks for allowlisting third-party/vendor classes.
- `require-nesting` supports `strict` (default) and `weak` modes.
- No autofix — all rules report only for now.
