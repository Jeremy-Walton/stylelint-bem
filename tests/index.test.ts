import type { Plugin } from 'stylelint';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import plugins from '@src/index.js';
import { ruleName } from '@src/rules/stylelint-bem/index.js';

function ruleNameOf(plugin: Plugin): string {
  return 'ruleName' in plugin ? plugin.ruleName : plugin.default!.ruleName;
}

describe('plugin entry', () => {
  it('exports the rule', () => {
    expect(plugins.map(ruleNameOf)).toEqual([ruleName]);
  });

  it('registers the rule with stylelint when used as config.plugins', async () => {
    const result = await stylelint.lint({
      code: '.card__title {}',
      config: {
        plugins,
        rules: { [ruleName]: true },
      },
    });

    const rulesReported = result.results[0]!.warnings.map((warning) => warning.rule);
    expect(rulesReported).toEqual([ruleName]);
  });
});
