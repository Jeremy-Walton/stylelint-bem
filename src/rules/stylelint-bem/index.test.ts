import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import { testRule } from '../../test-utils/test-rule.js';
import plugin, { messages, ruleName } from './index.js';

testRule({
  plugin,
  ruleName,
  config: true,
  reject: [
    {
      description: 'both checks run by default and report independently',
      code: '.card__title {} .card--featured {}',
      warnings: [
        { message: messages.orphanedElement('card__title', 'card') },
        { message: messages.orphanedModifier('card--featured', 'card') },
      ],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedElement: false } },
  accept: [
    {
      description: 'disabling noOrphanedElement silences only that check',
      code: '.card__title {}',
    },
  ],
  reject: [
    {
      description: 'the other check still runs',
      code: '.card--featured {}',
      warnings: [{ message: messages.orphanedModifier('card--featured', 'card') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedModifier: false } },
  accept: [
    {
      description: 'disabling noOrphanedModifier silences only that check',
      code: '.card--featured {}',
    },
  ],
  reject: [
    {
      description: 'the other check still runs',
      code: '.card__title {}',
      warnings: [{ message: messages.orphanedElement('card__title', 'card') }],
    },
  ],
});

describe(ruleName, () => {
  it('reports exactly one warning when the block exists but the modified element does not', async () => {
    const result = await stylelint.lint({
      code: '.card {} .card__title--large {}',
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    const warnings = result.results[0]!.warnings;
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.text).toContain(
      messages.orphanedModifier('card__title--large', 'card__title'),
    );
  });

  it('accepts a fully-defined block/element/modifier chain with both checks on', async () => {
    const result = await stylelint.lint({
      code: '.card { .card__title { &.card__title--large {} } }',
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('rejects an unknown checks key', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: {
        plugins: [plugin],
        rules: { [ruleName]: { checks: { bogus: true } } },
      },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });

  it('rejects a non-boolean, non-object primary option', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: { plugins: [plugin], rules: { [ruleName]: 'nonsense' } },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });
});
