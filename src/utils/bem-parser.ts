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
  const separators = getSeparatorTokens(options);
  const pattern = buildSeparatorPattern(separators);
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

// Well-defined even for non-BEM names — parseClassName treats the whole name as the block then.
function blockOf(className: string, options: BemSeparatorOptions): string {
  return parseClassName(className, options).block;
}

// True when className is itself a modifier of parentName, e.g. "block--mod" of "block", or
// "block__el--mod" of "block__el".
function isModifierOf(className: string, parentName: string, options: BemSeparatorOptions): boolean {
  const parsed = parseClassName(className, options);
  const finalSegment = lastSegment(parsed);
  if (!finalSegment || finalSegment.separator !== 'modifier') return false;

  return parentClassName(parsed, options) === parentName;
}

interface BemNaming {
  parse(className: string): ParsedBemClassName;
  format(block: string, segments: BemSegment[]): string;
  blockOf(className: string): string;
  isModifierOf(className: string, parentName: string): boolean;
  parentClassName(parsed: ParsedBemClassName): string;
  lastSegment(parsed: ParsedBemClassName): BemSegment | undefined;
}

// Binds BemSeparatorOptions once so callers stop re-passing it at every call site.
function bemNaming(options: BemSeparatorOptions): BemNaming {
  return {
    parse: (className) => parseClassName(className, options),
    format: (block, segments) => formatClassName(block, segments, options),
    blockOf: (className) => blockOf(className, options),
    isModifierOf: (className, parentName) => isModifierOf(className, parentName, options),
    parentClassName: (parsed) => parentClassName(parsed, options),
    lastSegment,
  };
}

export type { BemSeparatorOptions, BemSegmentSeparator, BemSegment, ParsedBemClassName, BemNaming };
export {
  parseClassName,
  isKebabCase,
  formatClassName,
  lastSegment,
  parentClassName,
  blockOf,
  isModifierOf,
  bemNaming,
};
