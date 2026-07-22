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
      description: 'two modifiers of the same block compounded together via "&" — each pairs with the other',
      code: '.card { &.card--dark.card--featured {} }',
    },
    {
      description: 'two modifiers compounded via "&", with a nested element inside',
      code: '.card { &.card--dark.card--featured { .card__title {} } }',
    },
    {
      description: 'the exact reported case (trimmed): a block with both single- and multi-modifier compound rules',
      code: `
        .alert {
          &.alert--banner {}

          &.alert--muted.alert--warning {
            .alert__icon {}
          }
        }
      `,
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
      description:
        'block+modifier compound preceded by a combinator — still paired directly, regardless of what precedes it',
      code: '.wrapper .card.card--featured {}',
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
    {
      description: 'classes referenced inside :has() are match conditions, not definitions',
      code: '.card { .card__title { &:has(> .field-group--full-width, > .rich-text) {} } }',
    },
    {
      description: 'a class referenced inside :has() at the top level is not checked',
      code: '.card:has(.nav__item) {}',
    },
    {
      description: 'a modifier referenced inside :not() is not checked',
      code: '.card { .card__title { &:not(.card__title--large) {} } }',
    },
    {
      description: 'element addressed via a chain off an ampersand-modifier compound, flattened in one selector',
      code: '.card { &.card--featured .card__title {} }',
    },
    {
      description: 'a modifier compound-nested directly inside a chained element rule',
      code: '.card { &.card--featured .card__title { &.card__title--large {} } }',
    },
    {
      description:
        'the exact reported case (trimmed): element reached via an ampersand-modifier chain, with a nested modifier inside a nested at-rule',
      code: `
        .expander {
          &.expander--ready .expander__area {
            &.expander__area--open {
              @starting-style {}
            }
          }
        }
      `,
    },
    {
      description:
        'element and its own modifier both compounded together in the same chained hop — both are accepted',
      code: '.card { &.card--featured .card__title.card__title--large {} }',
    },
    {
      description:
        'element addressed via a chain rooted in its own literal block name (no "&"), self-contained with no real ancestor at all',
      code: '.card .card__title {}',
    },
    {
      description: 'a block-literal chain is valid inside a transparent @media with no real ancestor rule',
      code: '@media (max-width: 768px) { .card .card__title {} }',
    },
    {
      description: 'a modifier compound-nested directly inside a block-literal chained element rule',
      code: '.card .card__title { &.card__title--large {} }',
    },
    {
      description:
        'the exact reported case (trimmed): a block-literal chained element under a transparent @media, with siblings',
      code: `
        @media (max-width: 768px) {
          .survey-form .survey-form__questions {
            .field-group {}

            .rich-text {
              &.rich-text--full-width {}
            }
          }
        }
      `,
    },
    {
      description: 'a block-literal chain root compounded with a modifier of the block',
      code: '.card.card--dark .card__title {}',
    },
    {
      description:
        'a block-literal chain root written with the modifier first still names the block among its classes',
      code: '.card--dark.card .card__title {}',
    },
    {
      description: 'a chain root that is a sibling element of the same block, not the bare block itself',
      code: '.stepper { .stepper__item .stepper__item-marker {} }',
    },
    {
      description: 'a pseudo-class attached to a chain root does not disqualify it (:first-child)',
      code: '.stepper { .stepper__item:first-child .stepper__item-marker {} }',
    },
    {
      description: 'a pseudo-class with an argument attached to a chain root does not disqualify it (:has())',
      code: '.stepper { .stepper__item:has(+ .separator-line) .stepper__item-marker {} }',
    },
    {
      description:
        'the exact reported case (trimmed): two chained rules, each rooted in a sibling element with a pseudo-class',
      code: `
        .stepper {
          .stepper__item:first-child .stepper__item-marker {}
          .stepper__item:has(+ .separator-line) .stepper__item-marker {}
        }
      `,
    },
    {
      description: 'a tag compounded with an element does not disqualify it (e.g. a custom element)',
      code: '.card { x-icon.card__icon {} }',
    },
    {
      description: 'a tag compounded with a modifier directly on its target does not disqualify it',
      code: 'x-icon.card.card--featured {}',
    },
    {
      description: 'a tag in a chain root does not disqualify the chain',
      code: 'x-icon.card .card__title {}',
    },
    {
      description:
        'the exact reported case (trimmed): a custom element tag compounded with a nested BEM element, wrapped in its real block',
      code: `
        .widget-panel {
          .widget-panel__body {
            x-icon.widget-panel__body-icon {
              &::part(icon) {}
            }
          }
        }
      `,
    },
  ],
  reject: [
    {
      description: 'element defined at the top level (not nested at all)',
      code: '.card {} .card__title {}',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: 'element nested under an unrelated block — strict requires the block itself',
      code: '.nav { .card__title {} }',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description:
        'a chain rooted in a sibling element is not self-contained the way a bare-block root is — the root element still needs its own nesting',
      code: '.stepper__item .stepper__item-marker {}',
      warnings: [{ message: messages.elementNotNested('stepper__item', 'stepper') }],
    },
    {
      description: "strict flags another block's element customized from within a component tree",
      code: '.panel { .panel__header { .accordion__marker {} } }',
      warnings: [{ message: messages.elementNotNested('accordion__marker', 'accordion') }],
    },
    {
      description: 'a block referenced inside :has() on an ancestor does not count as the block rule',
      code: '.nav:has(.card) { .card__title {} }',
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
      description: 'each un-nested element in a selector list is reported separately',
      code: '.card__title, .nav__title {}',
      warnings: [
        { message: messages.elementNotNested('card__title', 'card') },
        { message: messages.elementNotNested('nav__title', 'nav') },
      ],
    },
    {
      description:
        'an element-modifier is fine on its own — the violation is isolated to the element it is nested under',
      code: '.card__title { &.card__title--large {} } .card {}',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: "an element nested under another component still can't use the compound '&' shape",
      code: '.nav { &.card__title {} }',
      warnings: [{ message: messages.elementNotFullSelector('card__title') }],
    },
    {
      description: 'a chain rooted in a plain class-compound whose classes do not name the expected block',
      code: '.card { .wrapper.other-class .card__title {} }',
      warnings: [{ message: messages.elementNotFullSelector('card__title') }],
    },
    {
      description: 'the chain only extends one hop — a second hop past the ampersand root still needs its own rule',
      code: '.card { &.card--featured .wrapper .card__title {} }',
      warnings: [{ message: messages.elementNotFullSelector('card__title') }],
    },
    {
      description: 'an ampersand-chained element with no real ancestor rule at all is still flagged',
      code: '&.card--featured .card__title {}',
      warnings: [
        { message: messages.modifierNotNestedDirectly('card--featured', 'card') },
        { message: messages.elementNotNested('card__title', 'card') },
      ],
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
      description: "modifiers of different blocks compounded via '&' — not a legitimate pairing",
      code: '.card { &.card--featured.nav--active {} }',
      warnings: [
        { message: messages.modifierNotCompound('card--featured', 'card') },
        { message: messages.modifierNotCompound('nav--active', 'nav') },
      ],
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
      description: 'an element styled via :is() at the top level is still a definition and still checked',
      code: '.card {} :is(.card__title) {}',
      warnings: [{ message: messages.elementNotNested('card__title', 'card') }],
    },
    {
      description: "a block referenced inside :has() on an ancestor does not count as a modifier's target",
      code: '.nav:has(.card) { &.card--featured {} }',
      warnings: [{ message: messages.modifierNotNestedDirectly('card--featured', 'card') }],
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
    {
      description: "weak accepts an element nested under a different component's rule",
      code: '.nav { .card__title {} }',
    },
    {
      description: "weak accepts another block's element customized from within a component tree",
      code: '.panel { .panel__header { .accordion__marker {} } }',
    },
    {
      description: 'weak accepts an element addressed via an ampersand-modifier chain (no regression)',
      code: '.card { &.card--featured .card__title {} }',
    },
    {
      description: 'weak accepts a block-literal chained element with no real ancestor at all (no regression)',
      code: '.card .card__title {}',
    },
  ],
  reject: [
    {
      description: 'weak still flags an element written flat, with no ancestor at all',
      code: '.card__title {}',
      warnings: [{ message: messages.elementNotNestedAnywhere('card__title', 'card') }],
    },
    {
      description: 'weak still flags an ampersand-chained element with no real ancestor rule at all',
      code: '&.card--featured .card__title {}',
      warnings: [{ message: messages.elementNotNestedAnywhere('card__title', 'card') }],
    },
    {
      description: "weak still flags a chained element whose root doesn't name its expected block",
      code: '.wrapper .card__title {}',
      warnings: [{ message: messages.elementNotFullSelector('card__title') }],
    },
    {
      description: 'weak still flags a modifier nested under the wrong ancestor',
      code: '.nav { &.card--featured {} }',
      warnings: [{ message: messages.modifierNotNestedDirectly('card--featured', 'card') }],
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
