import { testRule } from '../../test-utils/test-rule.js';
import plugin, { messages, ruleName } from './index.js';

testRule({
  plugin,
  ruleName,
  config: true,
  accept: [
    {
      description: 'block and element defined as separate top-level rules',
      code: '.card {} .card__title {}',
    },
    {
      description: 'element nested inside its block',
      code: '.card { .card__title {} }',
    },
    {
      description: 'element with a trailing modifier, block defined',
      code: '.card {} .card__title--large {}',
    },
    {
      description: 'non-BEM class (no separators) is never checked',
      code: '.foo {}',
    },
  ],
  reject: [
    {
      description: 'element defined with no matching block anywhere in the file',
      code: '.card__title {}',
      warnings: [{ message: messages.rejected('card__title', 'card') }],
    },
    {
      description: 'double-nested element name still needs its leading block defined',
      code: '.card__header__title {}',
      warnings: [{ message: messages.rejected('card__header__title', 'card') }],
    },
    {
      description: 'element nested under an unrelated block does not satisfy the check',
      code: '.nav { .card__title {} }',
      warnings: [{ message: messages.rejected('card__title', 'card') }],
    },
    {
      description: 'each orphaned element in a selector list is reported separately',
      code: '.card__title, .nav__title {}',
      warnings: [
        { message: messages.rejected('card__title', 'card') },
        { message: messages.rejected('nav__title', 'nav') },
      ],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { ignoreSelectors: ['.foo__bar'] }],
  accept: [
    {
      description: 'orphaned element matching an ignored selector is not flagged',
      code: '.foo__bar {}',
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { elementSeparator: '-' }],
  accept: [
    {
      description: 'block and element defined using a custom element separator',
      code: '.card {} .card-title {}',
    },
  ],
  reject: [
    {
      description: 'orphaned element using a custom element separator',
      code: '.card-title {}',
      warnings: [{ message: messages.rejected('card-title', 'card') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: true,
  accept: [
    {
      description:
        'a class shaped like "block--modifier__element" is owned by no-orphaned-modifier, not this rule',
      code: '.card--featured__title {}',
    },
  ],
});
