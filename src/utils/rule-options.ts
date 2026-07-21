import type { BemSeparatorOptions } from './bem-parser.js';

interface BemSecondaryOptions {
  elementSeparator?: string;
  modifierSeparator?: string;
  ignoreSelectors?: (string | RegExp)[];
}

const DEFAULT_ELEMENT_SEPARATOR = '__';
const DEFAULT_MODIFIER_SEPARATOR = '--';

function resolveSeparatorOptions(secondary?: BemSecondaryOptions): BemSeparatorOptions {
  return {
    elementSeparator: secondary?.elementSeparator ?? DEFAULT_ELEMENT_SEPARATOR,
    modifierSeparator: secondary?.modifierSeparator ?? DEFAULT_MODIFIER_SEPARATOR,
  };
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

const secondaryOptionsSchema = {
  elementSeparator: [isString],
  modifierSeparator: [isString],
  ignoreSelectors: [isString, isRegExp],
};

export type { BemSecondaryOptions };
export { resolveSeparatorOptions, isIgnoredSelector, secondaryOptionsSchema };
