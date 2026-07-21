import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import { testRule } from '@tests/test-utils/test-rule.js';
import plugin, { messages, ruleName } from '@src/rules/require-nesting/index.js';

testRule({
  plugin,
  ruleName,
  config: true,
  accept: [
    {
      description: 'element nested directly inside its block',
      code: '.card { .card__title {} }',
    },
    {
      description: 'element nested at a deeper depth inside its block',
      code: '.card { .wrapper { .card__title {} } }',
    },
    {
      description: 'element nested inside @media which is itself nested in its block',
      code: '.card { @media (min-width: 600px) { .card__title {} } }',
    },
    {
      description: 'a pseudo-class attached to a nested element does not change its shape',
      code: '.card { .card__title:hover {} }',
    },
    {
      description: 'a valid selector list — both elements nested directly inside their own block',
      code: '.card { .card__title, .card__subtitle {} }',
    },
    {
      description: 'modifier compound-nested directly under its block',
      code: '.card { &.card--featured {} }',
    },
    {
      description: 'modifier compound-nested directly under its block via @media',
      code: '.card { @media (min-width: 600px) { &.card--featured {} } }',
    },
    {
      description: 'a pseudo-class attached to a compound modifier does not change its shape',
      code: '.card { &.card--featured:hover {} }',
    },
    {
      description: 'a valid selector list — both modifiers compound-nested directly under their block',
      code: '.card { &.card--featured, &.card--compact {} }',
    },
    {
      description: 'element-modifier compound-nested directly under its element, itself nested in its block',
      code: '.card { .card__title { &.card__title--large {} } }',
    },
    {
      description: 'modifier compounded directly with its block at the top level',
      code: '.card.card--featured { align-items: center; }',
    },
    {
      description: 'modifier compounded directly with its block, classes in reverse order',
      code: '.card--featured.card {}',
    },
    {
      description: 'a pseudo-class attached to a block+modifier compound does not change its shape',
      code: '.card.card--featured:hover {}',
    },
    {
      description: 'block+modifier compound nested under an unrelated ancestor — the compound itself pairs them',
      code: '.nav { .card.card--featured {} }',
    },
    {
      description: 'element compounded with its own modifier, nested in its block',
      code: '.card { .card__title.card__title--large {} }',
    },
    {
      description: 'element compounded with several of its own modifiers, nested in its block',
      code: '.card { .card__title.card__title--large.card__title--bold {} }',
    },
    {
      description: 'element nested inside a block+modifier compound rule counts as nested in its block',
      code: '.card.card--dark { .card__title {} }',
    },
    {
      description: 'modifier compound-nested under a block+modifier compound rule counts as directly under its block',
      code: '.card.card--dark { &.card--featured {} }',
    },
  ],
  reject: [
    {
      description: 'element defined at the top level (not nested at all)',
      code: '.card {} .card__title {}',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: 'element nested under an unrelated block',
      code: '.nav { .card__title {} }',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: 'element wrapped in @media that is not itself nested inside the block',
      code: '@media (min-width: 600px) { .card__title {} } .card {}',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: 'element written as a compound "&" selector instead of a full selector',
      code: '.card { &.card__title {} }',
      warnings: [{ message: messages.elementNotFullSelector('card__title') }],
    },
    {
      description: 'element preceded by a combinator (not the leading compound in its selector)',
      code: '.wrapper .card__title {}',
      warnings: [{ message: messages.elementNotFullSelector('card__title') }],
    },
    {
      description: 'each mismatched element in a selector list is reported separately',
      code: '.card { .card__title, .nav__title {} }',
      warnings: [{ message: messages.elementNotNested('nav__title', 'nav') }],
    },
    {
      description:
        'an element-modifier is fine on its own — the violation is isolated to the element it is nested under',
      code: '.card__title { &.card__title--large {} } .card {}',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: 'modifier written as a plain full selector instead of a compound "&" selector',
      code: '.card { .card--featured {} }',
      warnings: [{ message: messages.modifierNotCompound('card--featured', 'card') }],
    },
    {
      description: 'modifier compounded with a class other than its target',
      code: '.nav.card--featured {}',
      warnings: [{ message: messages.modifierNotCompound('card--featured', 'card') }],
    },
    {
      description: 'modifier compounded with a different modifier of the same block, without the block itself',
      code: '.card--dark.card--featured {}',
      warnings: [
        { message: messages.modifierNotCompound('card--dark', 'card') },
        { message: messages.modifierNotCompound('card--featured', 'card') },
      ],
    },
    {
      description: 'block+modifier compound preceded by a combinator is not a leading compound',
      code: '.wrapper .card.card--featured {}',
      warnings: [{ message: messages.modifierNotCompound('card--featured', 'card') }],
    },
    {
      description: 'element compounded with an unrelated class',
      code: '.card { .card__title.foo {} }',
      warnings: [{ message: messages.elementNotFullSelector('card__title') }],
    },
    {
      description:
        'element+modifier compound at the top level — the modifier is paired, but the element still is not nested in its block',
      code: '.card {} .card__title.card__title--large {}',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: 'modifier compound-nested under an unrelated block',
      code: '.nav { &.card--featured {} }',
      warnings: [{ message: messages.modifierNotNestedDirectly('card--featured', 'card') }],
    },
    {
      description: 'modifier compound-nested under an intermediate wrapper rule (not directly under its block)',
      code: '.card { .wrapper { &.card--featured {} } }',
      warnings: [{ message: messages.modifierNotNestedDirectly('card--featured', 'card') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { ignoreSelectors: ['.foo--bar'] }],
  accept: [
    {
      description: 'a top-level selector matching ignoreSelectors is never checked',
      code: '.foo--bar {}',
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: 'strict',
  reject: [
    {
      description: 'the string "strict" behaves identically to the default/true',
      code: '.card--featured {}',
      warnings: [{ message: messages.modifierNotCompound('card--featured', 'card') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: 'weak',
  accept: [
    {
      description: 'weak allows a modifier written flat, with no ancestor at all',
      code: '.card--featured {}',
    },
    {
      description: 'weak allows an element written flat, with no ancestor at all',
      code: '.card__title {}',
    },
    {
      description: 'weak still accepts a correctly compound-nested modifier (no regression)',
      code: '.card { &.card--featured {} }',
    },
    {
      description: 'weak still accepts a correctly nested element (no regression)',
      code: '.card { .card__title {} }',
    },
    {
      description: 'weak accepts a block+modifier compound under any ancestor',
      code: '.nav { .card.card--featured {} }',
    },
  ],
  reject: [
    {
      description: 'weak still flags a modifier nested under the wrong ancestor',
      code: '.nav { &.card--featured {} }',
      warnings: [{ message: messages.modifierNotNestedDirectly('card--featured', 'card') }],
    },
    {
      description: 'weak still flags an element nested under the wrong ancestor',
      code: '.nav { .card__title {} }',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: 'weak still flags a modifier that has an ancestor but is not compound-nested',
      code: '.card { .card--featured {} }',
      warnings: [{ message: messages.modifierNotCompound('card--featured', 'card') }],
    },
    {
      description: 'weak still flags an element that has an ancestor but uses a compound "&" selector',
      code: '.card { &.card__title {} }',
      warnings: [{ message: messages.elementNotFullSelector('card__title') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { elementSeparator: '-', modifierSeparator: '_' }],
  accept: [
    {
      description: 'element nested directly inside its block, using custom separators',
      code: '.card { .card-title {} }',
    },
    {
      description: 'modifier compound-nested directly under its block, using custom separators',
      code: '.card { &.card_featured {} }',
    },
    {
      description: 'modifier compounded directly with its block, using custom separators',
      code: '.card.card_featured {}',
    },
  ],
  reject: [
    {
      description: 'element defined at the top level, using custom separators',
      code: '.card {} .card-title {}',
      warnings: [{ message: messages.elementNotNested('card-title', 'card') }],
    },
    {
      description: 'modifier not compound-nested, using custom separators',
      code: '.card { .card_featured {} }',
      warnings: [{ message: messages.modifierNotCompound('card_featured', 'card') }],
    },
  ],
});

describe(ruleName, () => {
  it('rejects an unrecognized mode string', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: { plugins: [plugin], rules: { [ruleName]: 'bogus' } },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });

  it('rejects a non-boolean, non-string primary value', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: { plugins: [plugin], rules: { [ruleName]: 1 } },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });
});
