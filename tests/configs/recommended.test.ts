import stylelint from 'stylelint';
import type { Plugin } from 'stylelint';
import { describe, expect, it } from 'vitest';
import recommended from '@src/configs/recommended.js';
import noOrphanedElementPlugin, {
  ruleName as noOrphanedElementRule,
  messages as orphanedElementMessages,
} from '@src/rules/no-orphaned-element/index.js';
import noOrphanedModifierPlugin, {
  ruleName as noOrphanedModifierRule,
  messages as orphanedModifierMessages,
} from '@src/rules/no-orphaned-modifier/index.js';
import { ruleName as validNameRule } from '@src/rules/valid-name/index.js';
import { ruleName as noDoubleNestedElementRule } from '@src/rules/no-double-nested-element/index.js';
import { ruleName as requireNestingRule } from '@src/rules/require-nesting/index.js';

const ruleNames = [
  validNameRule,
  noOrphanedElementRule,
  noOrphanedModifierRule,
  noDoubleNestedElementRule,
];

const orphanPlugins: Plugin[] = [noOrphanedElementPlugin, noOrphanedModifierPlugin];
const orphanRules = { [noOrphanedElementRule]: true, [noOrphanedModifierRule]: true };

describe('recommended config', () => {
  it('enables the four BEM-correctness rules', () => {
    expect(recommended.rules).toEqual(Object.fromEntries(ruleNames.map((name) => [name, true])));
  });

  it('leaves require-nesting off so it can be opted into', () => {
    expect(recommended.rules).not.toHaveProperty(requireNestingRule);
  });

  it('registers the require-nesting plugin so an override can enable it', async () => {
    const result = await stylelint.lint({
      code: '.card {} .card__title {}',
      config: { ...recommended, rules: { ...recommended.rules, [requireNestingRule]: true } },
    });

    const warnings = result.results[0]!.warnings;
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.rule).toBe(requireNestingRule);
  });

  it('does not flag flat BEM out of the box', async () => {
    const result = await stylelint.lint({
      code: '.card {} .card__title {} .card.card--featured {} .card--jumbo {}',
      config: recommended,
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('flags orphaned elements and modifiers out of the box', async () => {
    const result = await stylelint.lint({
      code: '.card__title {} .card--featured {}',
      config: recommended,
    });

    const warnings = result.results[0]!.warnings;
    expect(warnings).toHaveLength(2);
    expect(warnings.every((warning) => ruleNames.includes(warning.rule))).toBe(true);
  });

  it('does not flag well-formed BEM CSS', async () => {
    const result = await stylelint.lint({
      code: '.card { .card__title {} &.card--featured {} }',
      config: recommended,
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('reports exactly one warning when the block exists but the modified element does not', async () => {
    const result = await stylelint.lint({
      code: '.card {} .card__title--large {}',
      config: { plugins: orphanPlugins, rules: orphanRules },
    });

    const warnings = result.results[0]!.warnings;
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.text).toContain(
      orphanedModifierMessages.orphanedModifier('card__title--large', 'card__title'),
    );
  });

  it('reports both an orphaned element and an orphaned modifier independently', async () => {
    const result = await stylelint.lint({
      code: '.card__title {} .card--featured {}',
      config: { plugins: orphanPlugins, rules: orphanRules },
    });

    const warnings = result.results[0]!.warnings.map((warning) => warning.text);
    expect(warnings).toContain(orphanedElementMessages.orphanedElement('card__title', 'card'));
    expect(warnings).toContain(orphanedModifierMessages.orphanedModifier('card--featured', 'card'));
  });
});
