import type { Config } from 'stylelint';
import plugins from '../index.js';
import { ruleName as validNameRule } from '../rules/valid-name/index.js';
import { ruleName as noOrphanedElementRule } from '../rules/no-orphaned-element/index.js';
import { ruleName as noOrphanedModifierRule } from '../rules/no-orphaned-modifier/index.js';
import { ruleName as noDoubleNestedElementRule } from '../rules/no-double-nested-element/index.js';
import { ruleName as requireNestingRule } from '../rules/require-nesting/index.js';

const config: Config = {
  plugins,
  rules: {
    [validNameRule]: true,
    [noOrphanedElementRule]: true,
    [noOrphanedModifierRule]: true,
    [noDoubleNestedElementRule]: true,
    [requireNestingRule]: true,
  },
};

export default config;
