import type { BemSeparatorOptions } from './bem-parser.js';

interface BemSharedOptions {
  elementSeparator?: string;
  modifierSeparator?: string;
  ignoreSelectors?: (string | RegExp)[];
  knownBlocks?: string[];
}

const DEFAULT_ELEMENT_SEPARATOR = '__';
const DEFAULT_MODIFIER_SEPARATOR = '--';

function resolveSeparatorOptions(shared?: BemSharedOptions): BemSeparatorOptions {
  return {
    elementSeparator: shared?.elementSeparator ?? DEFAULT_ELEMENT_SEPARATOR,
    modifierSeparator: shared?.modifierSeparator ?? DEFAULT_MODIFIER_SEPARATOR,
  };
}

function resolveKnownBlocks(shared?: BemSharedOptions): Set<string> {
  return new Set(shared?.knownBlocks ?? []);
}

function isIgnoredSelector(selector: string, ignoreSelectors?: (string | RegExp)[]): boolean {
  if (!ignoreSelectors) return false;

  return ignoreSelectors.some((pattern) =>
    typeof pattern === 'string' ? pattern === selector : pattern.test(selector),
  );
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

const sharedOptionsSchema = {
  elementSeparator: [isString],
  modifierSeparator: [isString],
  ignoreSelectors: [isString, isRegExp],
  knownBlocks: [isString],
};

export type { BemSharedOptions };
export {
  resolveSeparatorOptions,
  resolveKnownBlocks,
  isIgnoredSelector,
  isString,
  isRegExp,
  sharedOptionsSchema,
};
