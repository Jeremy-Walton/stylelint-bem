import { describe, expect, it } from 'vitest';
import { getClassNames } from './selector-walker.js';

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
