import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { buildDefinedClassIndex } from '../../utils/block-index.js';
import { scanProjectDefinedClassesForFile } from '../../utils/project-scan.js';
import {
  resolveKnownBlocks,
  resolveSeparatorOptions,
  sharedOptionsSchema,
} from '../../utils/rule-options.js';
import type { BemSharedOptions } from '../../utils/rule-options.js';
import type { CheckContext, RequireNestingMode } from './check-context.js';
import { checkNoDoubleNestedElement } from './checks/no-double-nested-element.js';
import { checkNoOrphanedElement } from './checks/no-orphaned-element.js';
import { checkNoOrphanedModifier } from './checks/no-orphaned-modifier.js';
import { checkRequireNesting } from './checks/require-nesting.js';
import { checkValidName } from './checks/valid-name.js';

const ruleName = 'plugin/stylelint-bem';

const messages = stylelint.utils.ruleMessages(ruleName, {
  orphanedElement: (className: string, blockName: string) =>
    `Expected the block ".${blockName}" to be defined in the project (required by orphaned element ".${className}")`,
  orphanedModifier: (className: string, targetName: string) =>
    `Expected ".${targetName}" to be defined in the project (required by orphaned modifier ".${className}")`,
  invalidName: (className: string) =>
    `Expected all parts of ".${className}" to be kebab-case (lowercase letters, digits, and single dashes)`,
  doubleNestedElement: (className: string, suggested: string) =>
    `BEM allows only one element level — flatten ".${className}" to ".${suggested}"`,
  elementAfterModifier: (className: string) =>
    `".${className}" is invalid — a modifier cannot be followed by an element`,
  elementNotFullSelector: (className: string) =>
    `Expected element ".${className}" to be its own full selector, not compounded with '&'`,
  elementNotNested: (className: string, blockName: string) =>
    `Expected element ".${className}" to be nested (at any depth) inside its block ".${blockName}" via native CSS nesting`,
  modifierNotCompound: (className: string) =>
    `Expected modifier ".${className}" to be a compound selector with '&' (e.g. "&.${className}")`,
  modifierNotNestedDirectly: (className: string, targetName: string) =>
    `Expected modifier ".${className}" to be nested directly inside ".${targetName}" via native CSS nesting`,
});

type CheckRunner = (root: Root, context: CheckContext) => void;

const CHECK_DEFINITIONS = {
  noOrphanedElement: checkNoOrphanedElement,
  noOrphanedModifier: checkNoOrphanedModifier,
  validName: checkValidName,
  noDoubleNestedElement: checkNoDoubleNestedElement,
  requireNesting: checkRequireNesting,
} satisfies Record<string, CheckRunner>;
const CHECK_NAMES = Object.keys(CHECK_DEFINITIONS) as (keyof typeof CHECK_DEFINITIONS)[];
type CheckName = (typeof CHECK_NAMES)[number];
type Checks = {
  [K in CheckName]?: K extends 'requireNesting' ? boolean | RequireNestingMode : boolean;
};

interface StylelintBemOptions extends BemSharedOptions {
  checks?: Checks;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequireNestingValue(value: unknown): value is boolean | RequireNestingMode {
  return typeof value === 'boolean' || value === 'strict' || value === 'weak';
}

function isChecksOption(value: unknown): boolean {
  if (!isPlainObject(value)) return false;

  return Object.entries(value).every(([key, checkValue]) => {
    if (!(CHECK_NAMES as readonly string[]).includes(key)) return false;

    return key === 'requireNesting'
      ? isRequireNestingValue(checkValue)
      : typeof checkValue === 'boolean';
  });
}

function resolveRequireNestingMode(checks: Checks): RequireNestingMode {
  return checks.requireNesting === 'weak' ? 'weak' : 'strict';
}

const rule: stylelint.Rule<true | StylelintBemOptions> = (primary) => {
  return async (root, result) => {
    const validPrimary = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [(value: unknown) => value === true || isPlainObject(value)],
    });

    if (!validPrimary) return;

    const options = primary === true ? undefined : primary;

    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: options,
      possible: { ...sharedOptionsSchema, checks: [isChecksOption] },
      optional: true,
    });

    if (!validOptions) return;

    const projectClasses = await scanProjectDefinedClassesForFile(root);
    const checks = options?.checks ?? {};

    const context: CheckContext = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(options),
      ignoreSelectors: options?.ignoreSelectors,
      knownBlocks: resolveKnownBlocks(options),
      definedClassIndex: new Set([...projectClasses, ...buildDefinedClassIndex(root)]),
      requireNestingMode: resolveRequireNestingMode(checks),
      messages,
    };

    for (const name of CHECK_NAMES) {
      if (checks[name] ?? true) CHECK_DEFINITIONS[name](root, context);
    }
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
