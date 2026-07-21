import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { formatClassName, parseClassName } from '../../../utils/bem-parser.js';
import { isIgnoredSelector } from '../../../utils/rule-options.js';
import { getClassNodes } from '../../../utils/selector-walker.js';
import type { CheckContext } from '../check-context.js';

function checkNoOrphanedModifier(root: Root, context: CheckContext): void {
  root.walkRules((ruleNode) => {
    for (const selector of ruleNode.selectors) {
      if (isIgnoredSelector(selector, context.ignoreSelectors)) continue;

      for (const classNode of getClassNodes(selector)) {
        const parsed = parseClassName(classNode.name, context.separatorOptions);

        if (!parsed.isBem) continue;

        const lastSegment = parsed.segments[parsed.segments.length - 1];
        if (lastSegment?.separator !== 'modifier') continue;

        const target = formatClassName(
          parsed.block,
          parsed.segments.slice(0, -1),
          context.separatorOptions,
        );

        if (context.definedClassIndex.has(target)) continue;

        stylelint.utils.report({
          message: context.message,
          messageArgs: [classNode.name, target],
          node: ruleNode,
          index: classNode.sourceIndex,
          endIndex: classNode.sourceIndex + classNode.name.length + 1,
          result: context.result,
          ruleName: context.ruleName,
        });
      }
    }
  });
}

export { checkNoOrphanedModifier };
