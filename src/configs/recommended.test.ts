import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import recommended from './recommended.js';
import { ruleName as noOrphanedElementRuleName } from '../rules/no-orphaned-element/index.js';
import { ruleName as noOrphanedModifierRuleName } from '../rules/no-orphaned-modifier/index.js';

describe('recommended config', () => {
  it('enables both rules', () => {
    expect(recommended.rules).toMatchObject({
      [noOrphanedElementRuleName]: true,
      [noOrphanedModifierRuleName]: true,
    });
  });

  it('flags orphaned elements and modifiers out of the box', async () => {
    const result = await stylelint.lint({
      code: '.card__title {} .card--featured {}',
      config: recommended,
    });

    const rulesReported = result.results[0]!.warnings.map((warning) => warning.rule).sort();
    expect(rulesReported).toEqual([noOrphanedElementRuleName, noOrphanedModifierRuleName].sort());
  });

  it('does not flag well-formed BEM CSS', async () => {
    const result = await stylelint.lint({
      code: '.card { .card__title {} &.card--featured {} }',
      config: recommended,
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });
});
