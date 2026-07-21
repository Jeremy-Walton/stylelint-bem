import type { Root } from 'postcss';
import { isKebabCase } from '../../../utils/bem-parser.js';
import { forEachBemClass, reportBemViolation } from '../check-context.js';
import type { CheckContext } from '../check-context.js';

function checkValidName(root: Root, context: CheckContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    const isValid =
      isKebabCase(parsed.block) && parsed.segments.every((segment) => isKebabCase(segment.name));

    if (isValid) return;

    reportBemViolation(context, ruleNode, classNode, context.messages.invalidName, classNode.name);
  });
}

export { checkValidName };
