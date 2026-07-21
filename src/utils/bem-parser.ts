interface BemSeparatorOptions {
  elementSeparator: string;
  modifierSeparator: string;
}

type BemSegmentSeparator = 'element' | 'modifier';

interface BemSegment {
  separator: BemSegmentSeparator;
  name: string;
}

interface ParsedBemClassName {
  isBem: boolean;
  block: string;
  segments: BemSegment[];
}

interface SeparatorToken {
  type: BemSegmentSeparator;
  value: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Longest-first so that if one separator's value contains the other's
// (e.g. a custom '__' vs '_'), the longer one always wins the match.
function getSeparatorTokens(options: BemSeparatorOptions): SeparatorToken[] {
  return [
    { type: 'element' as const, value: options.elementSeparator },
    { type: 'modifier' as const, value: options.modifierSeparator },
  ].sort((a, b) => b.value.length - a.value.length);
}

function buildSeparatorPattern(separators: SeparatorToken[]): RegExp {
  return new RegExp(separators.map((separator) => escapeRegExp(separator.value)).join('|'), 'g');
}

interface CompiledSeparators {
  tokens: SeparatorToken[];
  pattern: RegExp;
}

const compiledSeparatorsCache = new WeakMap<BemSeparatorOptions, CompiledSeparators>();

// separatorOptions is built once per lint run and reused across every class name parsed in
// that run, so caching per-options-object avoids recompiling the same regex per class name.
function getCompiledSeparators(options: BemSeparatorOptions): CompiledSeparators {
  let compiled = compiledSeparatorsCache.get(options);

  if (!compiled) {
    const tokens = getSeparatorTokens(options);
    compiled = { tokens, pattern: buildSeparatorPattern(tokens) };
    compiledSeparatorsCache.set(options, compiled);
  }

  return compiled;
}

function separatorTypeFor(value: string, separators: SeparatorToken[]): BemSegmentSeparator {
  return separators.find((separator) => separator.value === value)!.type;
}

function bemSegments(
  className: string,
  separatorMatches: RegExpMatchArray[],
  separators: SeparatorToken[],
): BemSegment[] {
  return separatorMatches.map((match, i) => {
    const nameStart = match.index! + match[0].length;
    const nameEnd = i + 1 < separatorMatches.length ? separatorMatches[i + 1].index! : className.length;

    return {
      separator: separatorTypeFor(match[0], separators),
      name: className.slice(nameStart, nameEnd),
    };
  });
}

function parseClassName(className: string, options: BemSeparatorOptions): ParsedBemClassName {
  const { tokens: separators, pattern } = getCompiledSeparators(options);
  const separatorMatches = [...className.matchAll(pattern)];

  if (separatorMatches.length === 0) {
    return { isBem: false, block: className, segments: [] };
  }

  return {
    isBem: true,
    block: className.slice(0, separatorMatches[0].index),
    segments: bemSegments(className, separatorMatches, separators),
  };
}

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isKebabCase(name: string): boolean {
  return KEBAB_CASE_PATTERN.test(name);
}

function separatorValueFor(type: BemSegmentSeparator, options: BemSeparatorOptions): string {
  return type === 'element' ? options.elementSeparator : options.modifierSeparator;
}

function formatClassName(
  block: string,
  segments: BemSegment[],
  options: BemSeparatorOptions,
): string {
  return segments.reduce(
    (className, segment) => className + separatorValueFor(segment.separator, options) + segment.name,
    block,
  );
}

export type { BemSeparatorOptions, BemSegmentSeparator, BemSegment, ParsedBemClassName };
export { parseClassName, isKebabCase, formatClassName };
