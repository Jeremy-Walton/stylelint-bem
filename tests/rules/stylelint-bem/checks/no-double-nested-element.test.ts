import { testRule } from '@tests/test-utils/test-rule.js';
import plugin, { messages, ruleName } from '@src/rules/stylelint-bem/index.js';

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedElement: false, noOrphanedModifier: false, validName: false } },
  accept: [
    {
      description: 'a single element level',
      code: '.card__title {}',
    },
    {
      description: 'a modifier on an element (element then modifier) is valid',
      code: '.card__title--large {}',
    },
    {
      description: 'a single modifier',
      code: '.card--featured {}',
    },
    {
      description: 'non-BEM class (no separators) is never checked',
      code: '.foo {}',
    },
    {
      description: 'a name containing a single dash is not mistaken for a chained separator',
      code: '.card__the-title {}',
    },
    {
      description: 'a name containing a single underscore is not mistaken for a chained separator',
      code: '.card--is_active {}',
    },
  ],
  reject: [
    {
      description: 'a double-nested element (two element levels) is invalid',
      code: '.card__header__title {}',
      warnings: [{ message: messages.doubleNestedElement('card__header__title', 'card__title') }],
    },
    {
      description: 'an element following a modifier is invalid',
      code: '.card--featured__title {}',
      warnings: [{ message: messages.elementAfterModifier('card--featured__title') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: {
    checks: { noOrphanedElement: false, noOrphanedModifier: false },
    elementSeparator: '-',
    modifierSeparator: '_',
  },
  accept: [
    {
      description: 'a single element level using custom separators',
      code: '.card-title {}',
    },
  ],
  reject: [
    {
      description: 'a double-nested element using custom separators',
      code: '.card-header-title {}',
      warnings: [{ message: messages.doubleNestedElement('card-header-title', 'card-title') }],
    },
    {
      description: 'an element following a modifier using custom separators',
      code: '.card_featured-title {}',
      warnings: [{ message: messages.elementAfterModifier('card_featured-title') }],
    },
  ],
});
