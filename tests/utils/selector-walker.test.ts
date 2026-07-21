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
    expect(getClassNodes('.card')).toEqual([{ name: 'card', sourceIndex: 0 }]);
  });

  it('reports source indices for compound class selectors', () => {
    expect(getClassNodes('.card.card--featured')).toEqual([
      { name: 'card', sourceIndex: 0 },
      { name: 'card--featured', sourceIndex: 5 },
    ]);
  });

  it('reports source indices across combinators', () => {
    expect(getClassNodes('.card > .card__title')).toEqual([
      { name: 'card', sourceIndex: 0 },
      { name: 'card__title', sourceIndex: 8 },
    ]);
  });

  it('reports source indices per selector in a selector list', () => {
    expect(getClassNodes('.card__title, .card__body')).toEqual([
      { name: 'card__title', sourceIndex: 0 },
      { name: 'card__body', sourceIndex: 14 },
    ]);
  });
});
