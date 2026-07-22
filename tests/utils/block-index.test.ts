import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { buildDefinedClassIndex } from '@src/utils/block-index.js';

function parse(css: string) {
  return postcss.parse(css);
}

describe('buildDefinedClassIndex', () => {
  it('indexes a single top-level block', () => {
    const root = parse('.card {}');
    expect(buildDefinedClassIndex(root)).toEqual(new Set(['card']));
  });

  it('indexes BEM-shaped classes too, not just bare blocks', () => {
    const root = parse(`
      .card {
        .card__title {}
        &.card--featured {}
      }
    `);
    expect(buildDefinedClassIndex(root)).toEqual(new Set(['card', 'card__title', 'card--featured']));
  });

  it('indexes every class of a compound multi-class selector', () => {
    const root = parse('.card.dark {}');
    expect(buildDefinedClassIndex(root)).toEqual(new Set(['card', 'dark']));
  });

  it('indexes every class of a chained (descendant-combinator) selector, not just the leading one', () => {
    const root = parse('.card .card__title {}');
    expect(buildDefinedClassIndex(root)).toEqual(new Set(['card', 'card__title']));
  });

  it('indexes both sides of a selector list', () => {
    const root = parse('.card__title, .nav__title {}');
    expect(buildDefinedClassIndex(root)).toEqual(new Set(['card__title', 'nav__title']));
  });
});
