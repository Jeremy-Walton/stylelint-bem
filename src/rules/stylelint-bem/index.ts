import stylelint from 'stylelint';
import { buildDefinedClassIndex } from '../../utils/block-index.js';
import { resolveSeparatorOptions, sharedOptionsSchema } from '../../utils/rule-options.js';
import type { BemSharedOptions } from '../../utils/rule-options.js';
import { checkNoOrphanedElement } from './checks/no-orphaned-element.js';
import { checkNoOrphanedModifier } from './checks/no-orphaned-modifier.js';

const ruleName = 'plugin/stylelint-bem';

const messages = stylelint.utils.ruleMessages(ruleName, {
  orphanedElement: (className: string, blockName: string) =>
    `Expected the block ".${blockName}" to be defined in this file (required by orphaned element ".${className}")`,
  orphanedModifier: (className: string, targetName: string) =>
    `Expected ".${targetName}" to be defined in this file (required by orphaned modifier ".${className}")`,
});

const CHECK_NAMES = ['noOrphanedElement', 'noOrphanedModifier'] as const;
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
  return (root, result) => {
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

    const context = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(options),
      ignoreSelectors: options?.ignoreSelectors,
      definedClassIndex: buildDefinedClassIndex(root),
    };

    const checks = options?.checks ?? {};

    if (checks.noOrphanedElement ?? true) {
      checkNoOrphanedElement(root, { ...context, message: messages.orphanedElement });
    }

    if (checks.noOrphanedModifier ?? true) {
      checkNoOrphanedModifier(root, { ...context, message: messages.orphanedModifier });
    }
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
