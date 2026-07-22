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

// Longest-first, so a separator whose value contains the other's (e.g. custom '__' vs '_') wins.
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

// Caches per options object so the regex isn't recompiled for every class name in a lint run.
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

function lastSegment(parsed: ParsedBemClassName): BemSegment | undefined {
  return parsed.segments[parsed.segments.length - 1];
}

// e.g. "block__el" for "block__el--mod", or "block" for "block--mod".
function parentClassName(parsed: ParsedBemClassName, options: BemSeparatorOptions): string {
  return formatClassName(parsed.block, parsed.segments.slice(0, -1), options);
}

export type { BemSeparatorOptions, BemSegmentSeparator, BemSegment, ParsedBemClassName };
export { parseClassName, isKebabCase, formatClassName, lastSegment, parentClassName };
