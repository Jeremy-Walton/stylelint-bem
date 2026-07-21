import { testRule } from '@tests/test-utils/test-rule.js';
import plugin, { messages, ruleName } from '@src/rules/stylelint-bem/index.js';

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedElement: false, noOrphanedModifier: false } },
  accept: [
    {
      description: 'kebab-case block, element, and modifier',
      code: '.my-block__my-el--my-mod {}',
    },
    {
      description: 'kebab-case parts containing digits',
      code: '.card-2__title-3--large-4 {}',
    },
    {
      description: 'non-BEM class (no separators) is never checked, even if not kebab-case',
      code: '.myBlock {}',
    },
  ],
  reject: [
    {
      description: 'block part is not kebab-case',
      code: '.myBlock--active {}',
      warnings: [{ message: messages.invalidName('myBlock--active') }],
    },
    {
      description: 'element part is not kebab-case',
      code: '.card__Title {}',
      warnings: [{ message: messages.invalidName('card__Title') }],
    },
    {
      description: 'modifier part is not kebab-case',
      code: '.card--Featured {}',
      warnings: [{ message: messages.invalidName('card--Featured') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: {
    checks: { noOrphanedElement: false, noOrphanedModifier: false },
    elementSeparator: '-',
  },
  accept: [
    {
      description: 'kebab-case parts using a custom element separator',
      code: '.card-title {}',
    },
  ],
  reject: [
    {
      description: 'invalid part using a custom element separator',
      code: '.card-Title {}',
      warnings: [{ message: messages.invalidName('card-Title') }],
    },
  ],
});
