import type { Plugin } from 'stylelint';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import plugins from './index.js';
import { ruleName as noOrphanedElementRuleName } from './rules/no-orphaned-element/index.js';
import { ruleName as noOrphanedModifierRuleName } from './rules/no-orphaned-modifier/index.js';

function ruleNameOf(plugin: Plugin): string {
  return 'ruleName' in plugin ? plugin.ruleName : plugin.default!.ruleName;
}

describe('plugin entry', () => {
  it('exports both rules', () => {
    expect(plugins.map(ruleNameOf).sort()).toEqual(
      [noOrphanedElementRuleName, noOrphanedModifierRuleName].sort(),
    );
  });

  it('registers both rules with stylelint when used as config.plugins', async () => {
    const result = await stylelint.lint({
      code: '.card__title {} .card--featured {}',
      config: {
        plugins,
        rules: {
          [noOrphanedElementRuleName]: true,
          [noOrphanedModifierRuleName]: true,
        },
      },
    });

    const rulesReported = result.results[0]!.warnings.map((warning) => warning.rule).sort();
    expect(rulesReported).toEqual([noOrphanedElementRuleName, noOrphanedModifierRuleName].sort());
  });
});
