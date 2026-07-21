import { testRule } from '@tests/test-utils/test-rule.js';
import plugin, { messages, ruleName } from '@src/rules/stylelint-bem/index.js';

const isolate = {
  noOrphanedElement: false,
  noOrphanedModifier: false,
  validName: false,
  noDoubleNestedElement: false,
};

testRule({
  plugin,
  ruleName,
  config: { checks: isolate },
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
      warnings: [{ message: messages.modifierNotCompound('card--featured') }],
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
  config: { checks: isolate, ignoreSelectors: ['.foo--bar'] },
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
  config: { checks: { ...isolate, requireNesting: 'strict' } },
  reject: [
    {
      description: 'the string "strict" behaves identically to the default/true',
      code: '.card--featured {}',
      warnings: [{ message: messages.modifierNotCompound('card--featured') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { ...isolate, requireNesting: false } },
  accept: [
    {
      description: 'false disables the check entirely, even for badly-shaped top-level classes',
      code: '.card__title {} .card--featured {} .card__header__title {}',
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { ...isolate, requireNesting: 'weak' } },
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
      warnings: [{ message: messages.modifierNotCompound('card--featured') }],
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
  config: { checks: isolate, elementSeparator: '-', modifierSeparator: '_' },
  accept: [
    {
      description: 'element nested directly inside its block, using custom separators',
      code: '.card { .card-title {} }',
    },
    {
      description: 'modifier compound-nested directly under its block, using custom separators',
      code: '.card { &.card_featured {} }',
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
      warnings: [{ message: messages.modifierNotCompound('card_featured') }],
    },
  ],
});
