import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import recommended from './recommended.js';
import { ruleName } from '../rules/stylelint-bem/index.js';

describe('recommended config', () => {
  it('enables the rule', () => {
    expect(recommended.rules).toMatchObject({
      [ruleName]: true,
    });
  });

  it('flags orphaned elements and modifiers out of the box', async () => {
    const result = await stylelint.lint({
      code: '.card__title {} .card--featured {}',
      config: recommended,
    });

    const warnings = result.results[0]!.warnings;
    expect(warnings).toHaveLength(2);
    expect(warnings.every((warning) => warning.rule === ruleName)).toBe(true);
  });

  it('does not flag well-formed BEM CSS', async () => {
    const result = await stylelint.lint({
      code: '.card { .card__title {} &.card--featured {} }',
      config: recommended,
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });
});
