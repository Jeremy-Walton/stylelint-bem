import type { Plugin } from 'stylelint';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import plugins from '@src/index.js';
import { ruleName as validNameRule } from '@src/rules/valid-name/index.js';
import { ruleName as noOrphanedElementRule } from '@src/rules/no-orphaned-element/index.js';
import { ruleName as noOrphanedModifierRule } from '@src/rules/no-orphaned-modifier/index.js';
import { ruleName as noDoubleNestedElementRule } from '@src/rules/no-double-nested-element/index.js';
import { ruleName as requireNestingRule } from '@src/rules/require-nesting/index.js';

const ruleNames = [
  validNameRule,
  noOrphanedElementRule,
  noOrphanedModifierRule,
  noDoubleNestedElementRule,
  requireNestingRule,
];

function ruleNameOf(plugin: Plugin): string {
  return 'ruleName' in plugin ? plugin.ruleName : plugin.default!.ruleName;
}

describe('plugin entry', () => {
  it('exports all five rules', () => {
    expect(plugins.map(ruleNameOf)).toEqual(ruleNames);
  });

  it('registers the rules with stylelint when used as config.plugins', async () => {
    const result = await stylelint.lint({
      code: '.card__title {}',
      config: {
        plugins,
        rules: Object.fromEntries(ruleNames.map((name) => [name, true])),
      },
    });

    const rulesReported = result.results[0]!.warnings.map((warning) => warning.rule).sort();
    expect(rulesReported).toEqual([noOrphanedElementRule, requireNestingRule].sort());
  });
});
