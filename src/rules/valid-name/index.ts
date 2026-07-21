import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { isKebabCase } from '../../utils/bem-parser.js';
import { bemBaseOptionsSchema, resolveSeparatorOptions } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { forEachBemClass, reportBemViolation } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

const ruleName = 'stylelint-bem/valid-name';

const messages = stylelint.utils.ruleMessages(ruleName, {
  invalidName: (className: string) =>
    `Expected all parts of ".${className}" to be kebab-case (lowercase letters, digits, and single dashes)`,
});

function checkValidName(root: Root, context: RuleContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    const isValid =
      isKebabCase(parsed.block) && parsed.segments.every((segment) => isKebabCase(segment.name));

    if (isValid) return;

    reportBemViolation(context, ruleNode, classNode, messages.invalidName, classNode.name);
  });
}

const rule: stylelint.Rule<true, BemBaseOptions> = (primary, secondaryOptions) => {
  return async (root, result) => {
    const validPrimary = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });

    if (!validPrimary) return;

    const validSecondary = stylelint.utils.validateOptions(result, ruleName, {
      actual: secondaryOptions,
      possible: bemBaseOptionsSchema,
      optional: true,
    });

    if (!validSecondary) return;

    const context: RuleContext = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(secondaryOptions),
      ignoreSelectors: secondaryOptions?.ignoreSelectors,
      messages,
    };

    checkValidName(root, context);
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
