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

  it('reports source indices for compound class selectors', () => {
    expect(getClassNodes('.card.card--featured')).toEqual([
      { name: 'card', sourceIndex: 0, nestingShape: 'other' },
      { name: 'card--featured', sourceIndex: 5, nestingShape: 'other' },
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
      { name: 'card__title', sourceIndex: 4, nestingShape: 'bare' },
    ]);
  });
});
