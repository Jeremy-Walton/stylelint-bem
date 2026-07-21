import type { Root, Rule } from 'postcss';
import { formatClassName } from '../../../utils/bem-parser.js';
import { findAncestorRules } from '../../../utils/rule-ancestors.js';
import { getClassNodes } from '../../../utils/selector-walker.js';
import { forEachBemClass, reportBemViolation } from '../check-context.js';
import type { CheckContext } from '../check-context.js';

function ruleHasBareMatch(ruleNode: Rule, className: string): boolean {
  return ruleNode.selectors.some((selector) =>
    getClassNodes(selector).some((node) => node.nestingShape === 'bare' && node.name === className),
  );
}

function checkRequireNesting(root: Root, context: CheckContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    const ancestorRules = findAncestorRules(ruleNode);

    // Weak mode only validates nesting when the author actually attempted it (there's at
    // least one ancestor rule). A class with no ancestor at all is left unchecked — the
    // common case being a page/feature file adding a modifier or element onto a block that's
    // defined (and nested) in a different, shared file, which strict mode can never satisfy.
    if (context.requireNestingMode === 'weak' && ancestorRules.length === 0) return;

    const lastSegment = parsed.segments[parsed.segments.length - 1]!;
    const expectedParentName = formatClassName(
      parsed.block,
      parsed.segments.slice(0, -1),
      context.separatorOptions,
    );

    if (lastSegment.separator === 'modifier') {
      if (classNode.nestingShape !== 'ampersand') {
        reportBemViolation(
          context,
          ruleNode,
          classNode,
          context.messages.modifierNotCompound,
          classNode.name,
        );
        return;
      }

      const parentRule = ancestorRules[0];
      if (!parentRule || !ruleHasBareMatch(parentRule, expectedParentName)) {
        reportBemViolation(
          context,
          ruleNode,
          classNode,
          context.messages.modifierNotNestedDirectly,
          classNode.name,
          expectedParentName,
        );
      }
      return;
    }

    if (classNode.nestingShape !== 'bare') {
      reportBemViolation(
        context,
        ruleNode,
        classNode,
        context.messages.elementNotFullSelector,
        classNode.name,
      );
      return;
    }

    const isNested = ancestorRules.some((ancestor) => ruleHasBareMatch(ancestor, expectedParentName));

    if (!isNested) {
      reportBemViolation(
        context,
        ruleNode,
        classNode,
        context.messages.elementNotNested,
        classNode.name,
        expectedParentName,
      );
    }
  });
}

export { checkRequireNesting };
