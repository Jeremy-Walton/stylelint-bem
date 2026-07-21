import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { buildBlockIndex, buildDefinedClassIndex } from '@src/utils/block-index.js';

const defaultOptions = { elementSeparator: '__', modifierSeparator: '--' };

function parse(css: string) {
  return postcss.parse(css);
}

describe('buildBlockIndex', () => {
  it('indexes a single top-level block', () => {
    const root = parse('.card { color: red; }');
    expect(buildBlockIndex(root, defaultOptions)).toEqual(new Set(['card']));
  });

  it('indexes multiple top-level blocks', () => {
    const root = parse('.card {} .nav {}');
    expect(buildBlockIndex(root, defaultOptions)).toEqual(new Set(['card', 'nav']));
  });

  it('indexes both sides of a selector list', () => {
    const root = parse('.card, .nav {}');
    expect(buildBlockIndex(root, defaultOptions)).toEqual(new Set(['card', 'nav']));
  });

  it('does not index nested elements or modifiers as blocks', () => {
    const root = parse(`
      .card {
        .card__title {}
        &.card--featured {}
      }
    `);
    expect(buildBlockIndex(root, defaultOptions)).toEqual(new Set(['card']));
  });

  it('does not index a compound multi-class selector as a block', () => {
    const root = parse('.card.dark {}');
    expect(buildBlockIndex(root, defaultOptions)).toEqual(new Set());
  });

  it('respects custom separators', () => {
    const root = parse('.card {} .card-title {}');
    const options = { elementSeparator: '-', modifierSeparator: '~~' };
    expect(buildBlockIndex(root, options)).toEqual(new Set(['card']));
  });
});

describe('buildDefinedClassIndex', () => {
  it('indexes a single top-level block', () => {
    const root = parse('.card {}');
    expect(buildDefinedClassIndex(root)).toEqual(new Set(['card']));
  });

  it('indexes BEM-shaped classes too, unlike buildBlockIndex', () => {
    const root = parse(`
      .card {
        .card__title {}
        &.card--featured {}
      }
    `);
    expect(buildDefinedClassIndex(root)).toEqual(new Set(['card', 'card__title', 'card--featured']));
  });

  it('does not index a compound multi-class selector', () => {
    const root = parse('.card.dark {}');
    expect(buildDefinedClassIndex(root)).toEqual(new Set());
  });

  it('indexes both sides of a selector list', () => {
    const root = parse('.card__title, .nav__title {}');
    expect(buildDefinedClassIndex(root)).toEqual(new Set(['card__title', 'nav__title']));
  });
});
