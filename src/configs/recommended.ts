import type { Config } from 'stylelint';
import plugins from '../index.js';
import { ruleName as noOrphanedElementRuleName } from '../rules/no-orphaned-element/index.js';
import { ruleName as noOrphanedModifierRuleName } from '../rules/no-orphaned-modifier/index.js';

const config: Config = {
  plugins,
  rules: {
    [noOrphanedElementRuleName]: true,
    [noOrphanedModifierRuleName]: true,
  },
};

export default config;
