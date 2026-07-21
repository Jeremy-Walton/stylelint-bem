import { describe, expect, it } from 'vitest';
import {
  isIgnoredSelector,
  resolveKnownBlocks,
  resolveSeparatorOptions,
} from '@src/utils/rule-options.js';

describe('resolveSeparatorOptions', () => {
  it('falls back to defaults when no secondary options are given', () => {
    expect(resolveSeparatorOptions(undefined)).toEqual({
      elementSeparator: '__',
      modifierSeparator: '--',
    });
  });

  it('falls back to defaults for options that are not set', () => {
    expect(resolveSeparatorOptions({ elementSeparator: '-' })).toEqual({
      elementSeparator: '-',
      modifierSeparator: '--',
    });
  });

  it('uses provided separators when set', () => {
    expect(
      resolveSeparatorOptions({ elementSeparator: '-', modifierSeparator: '~~' }),
    ).toEqual({
      elementSeparator: '-',
      modifierSeparator: '~~',
    });
  });
});

describe('resolveKnownBlocks', () => {
  it('returns an empty set when no known blocks are given', () => {
    expect(resolveKnownBlocks(undefined)).toEqual(new Set());
  });

  it('returns the configured block names as a set', () => {
    expect(resolveKnownBlocks({ knownBlocks: ['card', 'nav'] })).toEqual(new Set(['card', 'nav']));
  });
});

describe('isIgnoredSelector', () => {
  it('returns false when no ignore list is given', () => {
    expect(isIgnoredSelector('.card__title', undefined)).toBe(false);
  });

  it('matches an exact string entry', () => {
    expect(isIgnoredSelector('.card__title', ['.card__title'])).toBe(true);
    expect(isIgnoredSelector('.card__body', ['.card__title'])).toBe(false);
  });

  it('matches a regular expression entry', () => {
    expect(isIgnoredSelector('.card__title', [/^\.card__/])).toBe(true);
    expect(isIgnoredSelector('.nav__title', [/^\.card__/])).toBe(false);
  });

  it('matches if any entry in a mixed list matches', () => {
    expect(isIgnoredSelector('.nav__title', ['.card__title', /^\.nav__/])).toBe(true);
  });
});
