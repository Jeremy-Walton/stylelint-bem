import { testRule } from '../../../test-utils/test-rule.js';
import plugin, { messages, ruleName } from '../index.js';

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedElement: false } },
  accept: [
    {
      description: 'block and modifier defined as separate top-level rules',
      code: '.card {} .card--featured {}',
    },
    {
      description: 'modifier compound-nested inside its block',
      code: '.card { &.card--featured {} }',
    },
    {
      description: 'non-BEM class (no separators) is never checked',
      code: '.foo {}',
    },
    {
      description: 'element-modifier whose immediate target (the element) is itself defined',
      code: '.card { .card__title { &.card__title--large {} } }',
    },
    {
      description:
        'modifier-then-element is an invalid shape (a modifier cannot have an element after it) — left entirely to no-double-nested-element, not checked here',
      code: '.card--featured__title {}',
    },
  ],
  reject: [
    {
      description: 'modifier defined with no matching block anywhere in the file',
      code: '.card--featured {}',
      warnings: [{ message: messages.orphanedModifier('card--featured', 'card') }],
    },
    {
      description:
        'element-modifier whose immediate target (the element) was never defined, even though the root block was',
      code: '.card {} .card__title--large {}',
      warnings: [{ message: messages.orphanedModifier('card__title--large', 'card__title') }],
    },
    {
      description: 'modifier nested under an unrelated block does not satisfy the check',
      code: '.nav { &.card--featured {} }',
      warnings: [{ message: messages.orphanedModifier('card--featured', 'card') }],
    },
    {
      description: 'each orphaned modifier in a selector list is reported separately',
      code: '.card--featured, .nav--featured {}',
      warnings: [
        { message: messages.orphanedModifier('card--featured', 'card') },
        { message: messages.orphanedModifier('nav--featured', 'nav') },
      ],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedElement: false }, ignoreSelectors: ['.foo--bar'] },
  accept: [
    {
      description: 'orphaned modifier matching an ignored selector is not flagged',
      code: '.foo--bar {}',
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedElement: false }, modifierSeparator: '_' },
  accept: [
    {
      description: 'block and modifier defined using a custom modifier separator',
      code: '.card {} .card_featured {}',
    },
  ],
  reject: [
    {
      description: 'orphaned modifier using a custom modifier separator',
      code: '.card_featured {}',
      warnings: [{ message: messages.orphanedModifier('card_featured', 'card') }],
    },
  ],
});
