import type { Root } from 'postcss';
import { formatClassName } from '../../../utils/bem-parser.js';
import { forEachBemClass, isDefinedOrKnown, reportBemViolation } from '../check-context.js';
import type { CheckContext } from '../check-context.js';

function checkNoOrphanedModifier(root: Root, context: CheckContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    const lastSegment = parsed.segments[parsed.segments.length - 1];
    if (lastSegment?.separator !== 'modifier') return;

    const target = formatClassName(
      parsed.block,
      parsed.segments.slice(0, -1),
      context.separatorOptions,
    );

    if (isDefinedOrKnown(context, parsed.block, target)) return;

    reportBemViolation(
      context,
      ruleNode,
      classNode,
      context.messages.orphanedModifier,
      classNode.name,
      target,
    );
  });
}

export { checkNoOrphanedModifier };
