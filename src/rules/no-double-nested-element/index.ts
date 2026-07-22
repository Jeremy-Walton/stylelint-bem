import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { formatClassName, lastSegment } from '../../utils/bem-parser.js';
import { bemBaseOptionsSchema } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { createBemRule, forEachBemClass, reportBemViolation } from '../shared/rule-context.js';
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
        const suggested = formatClassName(parsed.block, [lastSegment(parsed)!], context.separatorOptions);
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

const rule = createBemRule<true, BemBaseOptions>({
  ruleName,
  messages,
  possiblePrimary: [true],
  secondarySchema: bemBaseOptionsSchema,
  check: checkNoDoubleNestedElement,
});

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
