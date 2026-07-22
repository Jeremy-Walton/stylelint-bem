import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { formatClassName } from '../../utils/bem-parser.js';
import { bemBaseOptionsSchema, resolveSeparatorOptions } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { forEachBemClass, reportBemViolation, validateBemOptions } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

const ruleName = 'stylelint-bem/no-double-nested-element';

const messages = stylelint.utils.ruleMessages(ruleName, {
  doubleNestedElement: (className: string, suggested: string) =>
    `BEM allows only one element level — flatten ".${className}" to ".${suggested}"`,
  elementAfterModifier: (className: string) =>
    `".${className}" is invalid — a modifier cannot be followed by an element`,
});

function checkNoDoubleNestedElement(root: Root, context: RuleContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    for (let i = 1; i < parsed.segments.length; i++) {
      const segment = parsed.segments[i]!;
      if (segment.separator !== 'element') continue;

      if (parsed.segments[i - 1]!.separator === 'element') {
        const lastSegment = parsed.segments[parsed.segments.length - 1]!;
        const suggested = formatClassName(parsed.block, [lastSegment], context.separatorOptions);
        reportBemViolation(
          context,
          ruleNode,
          classNode,
          messages.doubleNestedElement,
          classNode.name,
          suggested,
        );
      } else {
        reportBemViolation(context, ruleNode, classNode, messages.elementAfterModifier, classNode.name);
      }

      return;
    }
  });
}

const rule: stylelint.Rule<true, BemBaseOptions> = (primary, secondaryOptions) => {
  return async (root, result) => {
    const validOptions = validateBemOptions(
      result,
      ruleName,
      primary,
      [true],
      secondaryOptions,
      bemBaseOptionsSchema,
    );

    if (!validOptions) return;

    const context: RuleContext = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(secondaryOptions),
      ignoreSelectors: secondaryOptions?.ignoreSelectors,
      messages,
    };

    checkNoDoubleNestedElement(root, context);
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
