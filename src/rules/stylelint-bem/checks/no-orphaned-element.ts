import type { Root } from 'postcss';
import { forEachBemClass, reportBemViolation } from '../check-context.js';
import type { CheckContext } from '../check-context.js';

function checkNoOrphanedElement(root: Root, context: CheckContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    if (parsed.segments[0]?.separator !== 'element') return;
    if (context.definedClassIndex.has(parsed.block)) return;

    reportBemViolation(context, ruleNode, classNode, classNode.name, parsed.block);
  });
}

export { checkNoOrphanedElement };
