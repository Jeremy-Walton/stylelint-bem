import { describe, expect, it } from 'vitest';
import { getClassNames, getClassNodes } from '@src/utils/selector-walker.js';

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

  it('classifies a class compound that includes a tag as other', () => {
    expect(getClassNodes('div.card.card--featured')).toEqual([
      { name: 'card', sourceIndex: 3, nestingShape: 'other' },
      { name: 'card--featured', sourceIndex: 8, nestingShape: 'other' },
    ]);
  });

  it('classifies a class compound that includes "&" alongside other classes as other', () => {
    expect(getClassNodes('&.card.card--featured')).toEqual([
      { name: 'card', sourceIndex: 1, nestingShape: 'other' },
      { name: 'card--featured', sourceIndex: 6, nestingShape: 'other' },
    ]);
  });

  it('classifies a class compound preceded by a combinator as other', () => {
    expect(getClassNodes('.wrapper .card.card--featured')).toEqual([
      { name: 'wrapper', sourceIndex: 0, nestingShape: 'bare' },
      { name: 'card', sourceIndex: 9, nestingShape: 'other' },
      { name: 'card--featured', sourceIndex: 14, nestingShape: 'other' },
    ]);
  });

  it('reports source indices across combinators', () => {
    expect(getClassNodes('.card > .card__title')).toEqual([
      { name: 'card', sourceIndex: 0, nestingShape: 'bare' },
      { name: 'card__title', sourceIndex: 8, nestingShape: 'other' },
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

  it('classifies a class preceded by a descendant combinator as other', () => {
    expect(getClassNodes('.wrapper .card__title')).toEqual([
      { name: 'wrapper', sourceIndex: 0, nestingShape: 'bare' },
      { name: 'card__title', sourceIndex: 9, nestingShape: 'other' },
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
      { name: 'card__title', sourceIndex: 17, nestingShape: 'chained' },
    ]);
  });

  it('classifies a class after a bare ampersand root as chained', () => {
    expect(getClassNodes('& .card__title')).toEqual([{ name: 'card__title', sourceIndex: 2, nestingShape: 'chained' }]);
  });

  it('lists own-modifier sibling classes for a chained element', () => {
    expect(getClassNodes('&.card--featured .card__title.card__title--large')).toEqual([
      { name: 'card--featured', sourceIndex: 1, nestingShape: 'ampersand' },
      {
        name: 'card__title',
        sourceIndex: 17,
        nestingShape: 'chained',
        compoundClassNames: ['card__title--large'],
      },
      {
        name: 'card__title--large',
        sourceIndex: 29,
        nestingShape: 'chained',
        compoundClassNames: ['card__title'],
      },
    ]);
  });

  it('does not classify a class after a non-ampersand-rooted compound as chained', () => {
    expect(getClassNodes('.card.card--featured .card__title')).toEqual([
      { name: 'card', sourceIndex: 0, nestingShape: 'class-compound', compoundClassNames: ['card--featured'] },
      {
        name: 'card--featured',
        sourceIndex: 5,
        nestingShape: 'class-compound',
        compoundClassNames: ['card'],
      },
      { name: 'card__title', sourceIndex: 21, nestingShape: 'other' },
    ]);
  });

  it('only extends the chain one hop past the ampersand root', () => {
    expect(getClassNodes('&.card--featured .wrapper .card__title')).toEqual([
      { name: 'card--featured', sourceIndex: 1, nestingShape: 'ampersand' },
      { name: 'wrapper', sourceIndex: 17, nestingShape: 'chained' },
      { name: 'card__title', sourceIndex: 26, nestingShape: 'other' },
    ]);
  });
});
