import type { Root } from 'postcss';
import { formatClassName } from '../../../utils/bem-parser.js';
import { forEachBemClass, reportBemViolation } from '../check-context.js';
import type { CheckContext } from '../check-context.js';

function checkNoDoubleNestedElement(root: Root, context: CheckContext): void {
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
          context.messages.doubleNestedElement,
          classNode.name,
          suggested,
        );
      } else {
        reportBemViolation(
          context,
          ruleNode,
          classNode,
          context.messages.elementAfterModifier,
          classNode.name,
        );
      }

      return;
    }
  });
}

export { checkNoDoubleNestedElement };
