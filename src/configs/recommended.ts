import type { Config } from 'stylelint';
import plugins from '../index.js';
import { ruleName as validNameRule } from '../rules/valid-name/index.js';
import { ruleName as noOrphanedElementRule } from '../rules/no-orphaned-element/index.js';
import { ruleName as noOrphanedModifierRule } from '../rules/no-orphaned-modifier/index.js';
import { ruleName as noDoubleNestedElementRule } from '../rules/no-double-nested-element/index.js';

// `stylelint-bem/require-nesting` is deliberately absent: it enforces a structural
// convention rather than BEM validity, so it is opt-in.
const config: Config = {
  plugins,
  rules: {
    [validNameRule]: true,
    [noOrphanedElementRule]: true,
    [noOrphanedModifierRule]: true,
    [noDoubleNestedElementRule]: true,
  },
};

export default config;
