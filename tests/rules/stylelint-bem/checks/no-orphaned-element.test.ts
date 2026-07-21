import { testRule } from '@tests/test-utils/test-rule.js';
import plugin, { messages, ruleName } from '@src/rules/stylelint-bem/index.js';

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedModifier: false, noDoubleNestedElement: false } },
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
      warnings: [{ message: messages.orphanedElement('card__title', 'card') }],
    },
    {
      description: 'double-nested element name still needs its leading block defined',
      code: '.card__header__title {}',
      warnings: [{ message: messages.orphanedElement('card__header__title', 'card') }],
    },
    {
      description: 'element nested under an unrelated block does not satisfy the check',
      code: '.nav { .card__title {} }',
      warnings: [{ message: messages.orphanedElement('card__title', 'card') }],
    },
    {
      description: 'each orphaned element in a selector list is reported separately',
      code: '.card__title, .nav__title {}',
      warnings: [
        { message: messages.orphanedElement('card__title', 'card') },
        { message: messages.orphanedElement('nav__title', 'nav') },
      ],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedModifier: false }, ignoreSelectors: ['.foo__bar'] },
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
  config: { checks: { noOrphanedModifier: false }, elementSeparator: '-' },
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
      warnings: [{ message: messages.orphanedElement('card-title', 'card') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedModifier: false, noDoubleNestedElement: false } },
  accept: [
    {
      description:
        'a class shaped like "block--modifier__element" is an invalid shape (modifiers cannot be followed by an element) and is not this check\'s concern',
      code: '.card--featured__title {}',
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedModifier: false }, knownBlocks: ['card'] },
  accept: [
    {
      description: 'an element of a knownBlocks entry is never flagged, even though .card is never defined',
      code: '.card__title {}',
    },
  ],
  reject: [
    {
      description: 'an element of a block not in knownBlocks is still flagged',
      code: '.nav__title {}',
      warnings: [{ message: messages.orphanedElement('nav__title', 'nav') }],
    },
  ],
});
