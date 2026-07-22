import { describe, expect, it } from 'vitest';
import { getClassNames, getClassNodes, isPureAmpersandPseudoSelector } from '@src/utils/selector-walker.js';

describe('getClassNames', () => {
  it('extracts a single class name', () => {
    expect(getClassNames('.card')).toEqual(['card']);
  });

  it('extracts multiple compound class names', () => {
    expect(getClassNames('.card.card--featured')).toEqual(['card', 'card--featured']);
  });

  it('extracts class names across combinators', () => {
    expect(getClassNames('.card > .card__title')).toEqual(['card', 'card__title']);
  });

  it('extracts class names from a selector list', () => {
    expect(getClassNames('.card__title, .card__body')).toEqual(['card__title', 'card__body']);
  });

  it('extracts class names alongside a compound & nesting selector', () => {
    expect(getClassNames('&.card--featured')).toEqual(['card--featured']);
  });

  it('extracts class names nested inside :is()/:not()', () => {
    expect(getClassNames(':is(.card__title, .card__body)')).toEqual(['card__title', 'card__body']);
  });

  it('ignores non-class selector nodes', () => {
    expect(getClassNames('div#id[data-foo="bar"]:hover')).toEqual([]);
  });

  it('returns an empty array for a selector with no classes', () => {
    expect(getClassNames('* > div')).toEqual([]);
  });
});

describe('getClassNodes', () => {
  it('reports the source index of a single class', () => {
    expect(getClassNodes('.card')).toEqual([{ name: 'card', sourceIndex: 0, nestingShape: 'bare' }]);
  });

  it('classifies a class-only compound as class-compound, listing the sibling class names', () => {
    expect(getClassNodes('.card.card--featured')).toEqual([
      { name: 'card', sourceIndex: 0, nestingShape: 'class-compound', compoundClassNames: ['card--featured'] },
      { name: 'card--featured', sourceIndex: 5, nestingShape: 'class-compound', compoundClassNames: ['card'] },
    ]);
  });

  it('lists every sibling class of a three-class compound', () => {
    expect(getClassNodes('.card.card--featured.card--dark')).toEqual([
      { name: 'card', sourceIndex: 0, nestingShape: 'class-compound', compoundClassNames: ['card--featured', 'card--dark'] },
      { name: 'card--featured', sourceIndex: 5, nestingShape: 'class-compound', compoundClassNames: ['card', 'card--dark'] },
      { name: 'card--dark', sourceIndex: 20, nestingShape: 'class-compound', compoundClassNames: ['card', 'card--featured'] },
    ]);
  });

  it('tolerates a trailing pseudo-class on a class-compound selector', () => {
    expect(getClassNodes('.card.card--featured:hover')).toEqual([
      { name: 'card', sourceIndex: 0, nestingShape: 'class-compound', compoundClassNames: ['card--featured'] },
      { name: 'card--featured', sourceIndex: 5, nestingShape: 'class-compound', compoundClassNames: ['card'] },
    ]);
  });

  it('ignores a tag compounded with a single class, treating it as bare', () => {
    expect(getClassNodes('x-icon.widget-panel__body-icon')).toEqual([
      { name: 'widget-panel__body-icon', sourceIndex: 6, nestingShape: 'bare' },
    ]);
  });

  it('ignores a tag compounded with multiple classes, treating it as class-compound', () => {
    expect(getClassNodes('div.card.card--featured')).toEqual([
      { name: 'card', sourceIndex: 3, nestingShape: 'class-compound', compoundClassNames: ['card--featured'] },
      {
        name: 'card--featured',
        sourceIndex: 8,
        nestingShape: 'class-compound',
        compoundClassNames: ['card'],
      },
    ]);
  });

  it('ignores an id compounded with a class, treating it as bare', () => {
    expect(getClassNodes('#unique.card__title')).toEqual([
      { name: 'card__title', sourceIndex: 7, nestingShape: 'bare' },
    ]);
  });

  it('ignores a universal selector compounded with a class, treating it as bare', () => {
    expect(getClassNodes('*.card__title')).toEqual([
      { name: 'card__title', sourceIndex: 1, nestingShape: 'bare' },
    ]);
  });

  it('ignores a tag in a chain root, treating it the same as the class-only root', () => {
    expect(getClassNodes('x-icon.card--featured .card__title')).toEqual([
      { name: 'card--featured', sourceIndex: 6, nestingShape: 'bare' },
      {
        name: 'card__title',
        sourceIndex: 22,
        nestingShape: 'chained',
        chainRootHasAmpersand: false,
        chainRootClassNames: ['card--featured'],
      },
    ]);
  });

  it('classifies a class compound that includes "&" alongside other classes as ampersand, listing the sibling class names', () => {
    expect(getClassNodes('&.card.card--featured')).toEqual([
      { name: 'card', sourceIndex: 1, nestingShape: 'ampersand', compoundClassNames: ['card--featured'] },
      { name: 'card--featured', sourceIndex: 6, nestingShape: 'ampersand', compoundClassNames: ['card'] },
    ]);
  });

  it('lists every sibling class of a three-modifier ampersand compound', () => {
    expect(getClassNodes('&.alert--muted.alert--warning.alert--pulsing')).toEqual([
      {
        name: 'alert--muted',
        sourceIndex: 1,
        nestingShape: 'ampersand',
        compoundClassNames: ['alert--warning', 'alert--pulsing'],
      },
      {
        name: 'alert--warning',
        sourceIndex: 14,
        nestingShape: 'ampersand',
        compoundClassNames: ['alert--muted', 'alert--pulsing'],
      },
      {
        name: 'alert--pulsing',
        sourceIndex: 29,
        nestingShape: 'ampersand',
        compoundClassNames: ['alert--muted', 'alert--warning'],
      },
    ]);
  });

  it('classifies a class compound preceded by a combinator as chained, exposing the root classes', () => {
    expect(getClassNodes('.wrapper .card.card--featured')).toEqual([
      { name: 'wrapper', sourceIndex: 0, nestingShape: 'bare' },
      {
        name: 'card',
        sourceIndex: 9,
        nestingShape: 'chained',
        compoundClassNames: ['card--featured'],
        chainRootHasAmpersand: false,
        chainRootClassNames: ['wrapper'],
      },
      {
        name: 'card--featured',
        sourceIndex: 14,
        nestingShape: 'chained',
        compoundClassNames: ['card'],
        chainRootHasAmpersand: false,
        chainRootClassNames: ['wrapper'],
      },
    ]);
  });

  it('reports source indices across combinators', () => {
    expect(getClassNodes('.card > .card__title')).toEqual([
      { name: 'card', sourceIndex: 0, nestingShape: 'bare' },
      {
        name: 'card__title',
        sourceIndex: 8,
        nestingShape: 'chained',
        chainRootHasAmpersand: false,
        chainRootClassNames: ['card'],
      },
    ]);
  });

  it('reports source indices per selector in a selector list', () => {
    expect(getClassNodes('.card__title, .card__body')).toEqual([
      { name: 'card__title', sourceIndex: 0, nestingShape: 'bare' },
      { name: 'card__body', sourceIndex: 14, nestingShape: 'bare' },
    ]);
  });

  it('classifies a class compounded with the nesting selector "&" as ampersand', () => {
    expect(getClassNodes('&.card--featured')).toEqual([
      { name: 'card--featured', sourceIndex: 1, nestingShape: 'ampersand' },
    ]);
  });

  it('tolerates a trailing pseudo-class on a bare selector', () => {
    expect(getClassNodes('.card__title:hover')).toEqual([
      { name: 'card__title', sourceIndex: 0, nestingShape: 'bare' },
    ]);
  });

  it('tolerates a trailing pseudo-class on an ampersand-compound selector', () => {
    expect(getClassNodes('&.card--featured:hover')).toEqual([
      { name: 'card--featured', sourceIndex: 1, nestingShape: 'ampersand' },
    ]);
  });

  it('classifies a class preceded by a descendant combinator as chained, exposing the root classes', () => {
    expect(getClassNodes('.wrapper .card__title')).toEqual([
      { name: 'wrapper', sourceIndex: 0, nestingShape: 'bare' },
      {
        name: 'card__title',
        sourceIndex: 9,
        nestingShape: 'chained',
        chainRootHasAmpersand: false,
        chainRootClassNames: ['wrapper'],
      },
    ]);
  });

  it('classifies a class nested inside :is() relative to its own sub-container', () => {
    expect(getClassNodes(':is(.card__title)')).toEqual([
      { name: 'card__title', sourceIndex: 4, nestingShape: 'bare', enclosingPseudos: [':is'] },
    ]);
  });

  it('records the enclosing pseudo of a class inside :has()', () => {
    expect(getClassNodes('&:has(.card--featured)')).toEqual([
      { name: 'card--featured', sourceIndex: 6, nestingShape: 'bare', enclosingPseudos: [':has'] },
    ]);
  });

  it('records every enclosing pseudo, outermost first', () => {
    expect(getClassNodes(':has(:is(.card__title))')).toEqual([
      { name: 'card__title', sourceIndex: 9, nestingShape: 'bare', enclosingPseudos: [':has', ':is'] },
    ]);
  });

  it('classifies a class after an ampersand-rooted compound as chained', () => {
    expect(getClassNodes('&.card--featured .card__title')).toEqual([
      { name: 'card--featured', sourceIndex: 1, nestingShape: 'ampersand' },
      {
        name: 'card__title',
        sourceIndex: 17,
        nestingShape: 'chained',
        chainRootHasAmpersand: true,
        chainRootClassNames: ['card--featured'],
      },
    ]);
  });

  it('classifies a class after a bare ampersand root as chained', () => {
    expect(getClassNodes('& .card__title')).toEqual([
      {
        name: 'card__title',
        sourceIndex: 2,
        nestingShape: 'chained',
        chainRootHasAmpersand: true,
        chainRootClassNames: [],
      },
    ]);
  });

  it('lists own-modifier sibling classes for a chained element', () => {
    expect(getClassNodes('&.card--featured .card__title.card__title--large')).toEqual([
      { name: 'card--featured', sourceIndex: 1, nestingShape: 'ampersand' },
      {
        name: 'card__title',
        sourceIndex: 17,
        nestingShape: 'chained',
        compoundClassNames: ['card__title--large'],
        chainRootHasAmpersand: true,
        chainRootClassNames: ['card--featured'],
      },
      {
        name: 'card__title--large',
        sourceIndex: 29,
        nestingShape: 'chained',
        compoundClassNames: ['card__title'],
        chainRootHasAmpersand: true,
        chainRootClassNames: ['card--featured'],
      },
    ]);
  });

  it('also classifies a class after a plain (non-ampersand) class-compound root as chained', () => {
    expect(getClassNodes('.card.card--featured .card__title')).toEqual([
      { name: 'card', sourceIndex: 0, nestingShape: 'class-compound', compoundClassNames: ['card--featured'] },
      {
        name: 'card--featured',
        sourceIndex: 5,
        nestingShape: 'class-compound',
        compoundClassNames: ['card'],
      },
      {
        name: 'card__title',
        sourceIndex: 21,
        nestingShape: 'chained',
        chainRootHasAmpersand: false,
        chainRootClassNames: ['card', 'card--featured'],
      },
    ]);
  });

  it('only extends the chain one hop past the root, regardless of ampersand', () => {
    expect(getClassNodes('&.card--featured .wrapper .card__title')).toEqual([
      { name: 'card--featured', sourceIndex: 1, nestingShape: 'ampersand' },
      {
        name: 'wrapper',
        sourceIndex: 17,
        nestingShape: 'chained',
        chainRootHasAmpersand: true,
        chainRootClassNames: ['card--featured'],
      },
      { name: 'card__title', sourceIndex: 26, nestingShape: 'other' },
    ]);
  });

  it('classifies a class after a single-class, non-ampersand root as chained (the block-literal case)', () => {
    expect(getClassNodes('.survey-form .survey-form__questions')).toEqual([
      { name: 'survey-form', sourceIndex: 0, nestingShape: 'bare' },
      {
        name: 'survey-form__questions',
        sourceIndex: 13,
        nestingShape: 'chained',
        chainRootHasAmpersand: false,
        chainRootClassNames: ['survey-form'],
      },
    ]);
  });

  it('tolerates a pseudo-class attached to a chain root, e.g. :first-child', () => {
    expect(getClassNodes('.stepper__item:first-child .stepper__item-marker')).toEqual([
      { name: 'stepper__item', sourceIndex: 0, nestingShape: 'bare' },
      {
        name: 'stepper__item-marker',
        sourceIndex: 27,
        nestingShape: 'chained',
        chainRootHasAmpersand: false,
        chainRootClassNames: ['stepper__item'],
      },
    ]);
  });

  it('tolerates a pseudo-class with an argument attached to a chain root, e.g. :has()', () => {
    expect(getClassNodes('.stepper__item:has(+ .separator-line) .stepper__item-marker')).toEqual([
      { name: 'stepper__item', sourceIndex: 0, nestingShape: 'bare' },
      { name: 'separator-line', sourceIndex: 21, nestingShape: 'other', enclosingPseudos: [':has'] },
      {
        name: 'stepper__item-marker',
        sourceIndex: 38,
        nestingShape: 'chained',
        chainRootHasAmpersand: false,
        chainRootClassNames: ['stepper__item'],
      },
    ]);
  });

  it('classifies a class-only selector that starts with a bare combinator as chained with an implicit ampersand root', () => {
    expect(getClassNodes('+ .block__label')).toEqual([
      {
        name: 'block__label',
        sourceIndex: 2,
        nestingShape: 'chained',
        chainRootHasAmpersand: true,
        chainRootClassNames: [],
      },
    ]);
  });

  it('classifies a class after a classless (bare tag) chain root as chained with no chain root classes at all — the exact reported case', () => {
    expect(getClassNodes('summary .block__element')).toEqual([
      {
        name: 'block__element',
        sourceIndex: 8,
        nestingShape: 'chained',
        chainRootHasAmpersand: false,
        chainRootClassNames: [],
      },
    ]);
  });

  it('classifies a class after a leading-combinator root that itself contains a tag as chained with an implicit ampersand root — the exact reported case', () => {
    expect(getClassNodes('> summary .block__element')).toEqual([
      {
        name: 'block__element',
        sourceIndex: 10,
        nestingShape: 'chained',
        chainRootHasAmpersand: true,
        chainRootClassNames: [],
      },
    ]);
  });
});

describe('isPureAmpersandPseudoSelector', () => {
  it('accepts a bare ampersand with a single pseudo-class', () => {
    expect(isPureAmpersandPseudoSelector('&:hover')).toBe(true);
  });

  it('accepts a bare ampersand with a pseudo-class that takes a selector argument', () => {
    expect(isPureAmpersandPseudoSelector('&:has(.other)')).toBe(true);
  });

  it('accepts a bare ampersand with several chained pseudo-classes', () => {
    expect(isPureAmpersandPseudoSelector('&:has(.other):hover')).toBe(true);
  });

  it('accepts a bare ampersand with no pseudo-class at all — a no-op wrapper, still the same subject', () => {
    expect(isPureAmpersandPseudoSelector('&')).toBe(true);
  });

  it('rejects a class compounded alongside the ampersand, even with a pseudo-class present', () => {
    expect(isPureAmpersandPseudoSelector('&.other-class:hover')).toBe(false);
  });

  it('rejects a selector with no ampersand at all', () => {
    expect(isPureAmpersandPseudoSelector(':hover')).toBe(false);
  });

  it('rejects a chain (internal combinator), even one rooted in a bare ampersand', () => {
    expect(isPureAmpersandPseudoSelector('&:hover .block__el')).toBe(false);
  });

  it('does not let a class inside the pseudo argument disqualify the selector', () => {
    expect(isPureAmpersandPseudoSelector('&:has(.other, .thing)')).toBe(true);
  });
});
