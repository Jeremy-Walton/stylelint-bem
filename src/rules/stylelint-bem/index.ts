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
import type { CheckContext } from './check-context.js';
import { checkNoOrphanedElement } from './checks/no-orphaned-element.js';
import { checkNoOrphanedModifier } from './checks/no-orphaned-modifier.js';

const ruleName = 'plugin/stylelint-bem';

const messages = stylelint.utils.ruleMessages(ruleName, {
  orphanedElement: (className: string, blockName: string) =>
    `Expected the block ".${blockName}" to be defined in this file (required by orphaned element ".${className}")`,
  orphanedModifier: (className: string, targetName: string) =>
    `Expected ".${targetName}" to be defined in this file (required by orphaned modifier ".${className}")`,
});

type CheckRunner = (root: Root, context: CheckContext) => void;

const CHECK_DEFINITIONS = {
  noOrphanedElement: { run: checkNoOrphanedElement, message: messages.orphanedElement },
  noOrphanedModifier: { run: checkNoOrphanedModifier, message: messages.orphanedModifier },
} satisfies Record<string, { run: CheckRunner; message: stylelint.RuleMessage }>;
const CHECK_NAMES = Object.keys(CHECK_DEFINITIONS) as (keyof typeof CHECK_DEFINITIONS)[];
type CheckName = (typeof CHECK_NAMES)[number];
type Checks = Partial<Record<CheckName, boolean>>;

interface StylelintBemOptions extends BemSharedOptions {
  checks?: Checks;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChecksOption(value: unknown): boolean {
  if (!isPlainObject(value)) return false;

  return Object.entries(value).every(
    ([key, checkValue]) =>
      (CHECK_NAMES as readonly string[]).includes(key) && typeof checkValue === 'boolean',
  );
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

    const context = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(options),
      ignoreSelectors: options?.ignoreSelectors,
      knownBlocks: resolveKnownBlocks(options),
      definedClassIndex: new Set([...projectClasses, ...buildDefinedClassIndex(root)]),
    };

    const checks = options?.checks ?? {};

    for (const name of CHECK_NAMES) {
      if (checks[name] ?? true) {
        const { run, message } = CHECK_DEFINITIONS[name];
        run(root, { ...context, message });
      }
    }
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
