import { testRule } from '@tests/test-utils/test-rule.js';
import plugin, { messages, ruleName } from '@src/rules/valid-name/index.js';

testRule({
  plugin,
  ruleName,
  config: true,
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
    {
      description: 'a bare block with no BEM element/modifier referencing it anywhere is never checked',
      code: '.myBlock {} .myBlock-unrelated {}',
    },
    {
      description: 'a kebab-case bare block that is referenced by a nested BEM element',
      code: '.my-block { .my-block__title {} }',
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
    {
      description: 'a bare block is not kebab-case, and is referenced by a nested BEM element',
      code: '.myBlock { .myBlock__title {} }',
      warnings: [
        { message: messages.invalidName('myBlock__title') },
        { message: messages.invalidName('myBlock') },
      ],
    },
    {
      description: 'a bare block is not kebab-case, and is referenced by a nested BEM modifier',
      code: '.myBlock { &.myBlock--active {} }',
      warnings: [
        { message: messages.invalidName('myBlock--active') },
        { message: messages.invalidName('myBlock') },
      ],
    },
    {
      description: 'a bare block is not kebab-case, and is referenced by a BEM element elsewhere in the file (not nested under it)',
      code: '.myBlock {} .myBlock__title {}',
      warnings: [
        { message: messages.invalidName('myBlock__title') },
        { message: messages.invalidName('myBlock') },
      ],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { elementSeparator: '-' }],
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
