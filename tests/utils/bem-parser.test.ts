import { describe, expect, it } from 'vitest';
import { formatClassName, isKebabCase, parseClassName } from '@src/utils/bem-parser.js';

const defaultOptions = { elementSeparator: '__', modifierSeparator: '--' };

describe('parseClassName', () => {
  it('classifies a plain class with no separators as non-BEM (block only)', () => {
    expect(parseClassName('card', defaultOptions)).toEqual({
      isBem: false,
      block: 'card',
      segments: [],
    });
  });

  it('parses a block__element name', () => {
    expect(parseClassName('card__title', defaultOptions)).toEqual({
      isBem: true,
      block: 'card',
      segments: [{ separator: 'element', name: 'title' }],
    });
  });

  it('parses a block--modifier name', () => {
    expect(parseClassName('card--featured', defaultOptions)).toEqual({
      isBem: true,
      block: 'card',
      segments: [{ separator: 'modifier', name: 'featured' }],
    });
  });

  it('parses a block__element--modifier name', () => {
    expect(parseClassName('card__title--large', defaultOptions)).toEqual({
      isBem: true,
      block: 'card',
      segments: [
        { separator: 'element', name: 'title' },
        { separator: 'modifier', name: 'large' },
      ],
    });
  });

  it('parses a double-nested element name (invalid shape, still parseable)', () => {
    expect(parseClassName('card__header__title', defaultOptions)).toEqual({
      isBem: true,
      block: 'card',
      segments: [
        { separator: 'element', name: 'header' },
        { separator: 'element', name: 'title' },
      ],
    });
  });

  it('parses an element nested under a modifier (invalid shape, still parseable)', () => {
    expect(parseClassName('card--featured__title', defaultOptions)).toEqual({
      isBem: true,
      block: 'card',
      segments: [
        { separator: 'modifier', name: 'featured' },
        { separator: 'element', name: 'title' },
      ],
    });
  });

  it('does not mistake single dashes/underscores in kebab-ish parts for separators', () => {
    expect(parseClassName('my-block__el-thing--is-large', defaultOptions)).toEqual({
      isBem: true,
      block: 'my-block',
      segments: [
        { separator: 'element', name: 'el-thing' },
        { separator: 'modifier', name: 'is-large' },
      ],
    });

    expect(parseClassName('foo_bar', defaultOptions)).toEqual({
      isBem: false,
      block: 'foo_bar',
      segments: [],
    });
  });

  it('flags non-kebab-case parts without changing the parsed structure', () => {
    expect(parseClassName('myBlock--active', defaultOptions)).toEqual({
      isBem: true,
      block: 'myBlock',
      segments: [{ separator: 'modifier', name: 'active' }],
    });

    expect(parseClassName('card__Title', defaultOptions)).toEqual({
      isBem: true,
      block: 'card',
      segments: [{ separator: 'element', name: 'Title' }],
    });
  });

  it('respects custom separators', () => {
    const options = { elementSeparator: '-', modifierSeparator: '~~' };
    expect(parseClassName('card-title~~large', options)).toEqual({
      isBem: true,
      block: 'card',
      segments: [
        { separator: 'element', name: 'title' },
        { separator: 'modifier', name: 'large' },
      ],
    });
  });
});

describe('isKebabCase', () => {
  it('accepts lowercase single-word names', () => {
    expect(isKebabCase('card')).toBe(true);
  });

  it('accepts hyphenated lowercase/digit names', () => {
    expect(isKebabCase('my-block-2')).toBe(true);
  });

  it('rejects camelCase or PascalCase names', () => {
    expect(isKebabCase('myBlock')).toBe(false);
    expect(isKebabCase('CardTitle')).toBe(false);
  });

  it('rejects names with consecutive, leading, or trailing dashes', () => {
    expect(isKebabCase('foo--bar')).toBe(false);
    expect(isKebabCase('-foo')).toBe(false);
    expect(isKebabCase('foo-')).toBe(false);
  });

  it('rejects empty names', () => {
    expect(isKebabCase('')).toBe(false);
  });
});

describe('formatClassName', () => {
  it('formats a bare block with no segments', () => {
    expect(formatClassName('card', [], defaultOptions)).toBe('card');
  });

  it('formats a block with a single element segment', () => {
    expect(
      formatClassName('card', [{ separator: 'element', name: 'title' }], defaultOptions),
    ).toBe('card__title');
  });

  it('formats a block with a single modifier segment', () => {
    expect(
      formatClassName('card', [{ separator: 'modifier', name: 'featured' }], defaultOptions),
    ).toBe('card--featured');
  });

  it('formats a block with an element then a modifier', () => {
    expect(
      formatClassName(
        'card',
        [
          { separator: 'element', name: 'title' },
          { separator: 'modifier', name: 'large' },
        ],
        defaultOptions,
      ),
    ).toBe('card__title--large');
  });

  it('respects custom separators', () => {
    const options = { elementSeparator: '-', modifierSeparator: '~' };
    expect(formatClassName('card', [{ separator: 'element', name: 'title' }], options)).toBe(
      'card-title',
    );
  });

  it('round-trips with parseClassName', () => {
    const original = 'card__title--large';
    const parsed = parseClassName(original, defaultOptions);
    expect(formatClassName(parsed.block, parsed.segments, defaultOptions)).toBe(original);
  });
});
