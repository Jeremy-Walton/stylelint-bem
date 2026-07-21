import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { parseClassName } from '../../../utils/bem-parser.js';
import { isIgnoredSelector } from '../../../utils/rule-options.js';
import { getClassNodes } from '../../../utils/selector-walker.js';
import type { CheckContext } from '../check-context.js';

function checkNoOrphanedElement(root: Root, context: CheckContext): void {
  root.walkRules((ruleNode) => {
    for (const selector of ruleNode.selectors) {
      if (isIgnoredSelector(selector, context.ignoreSelectors)) continue;

      for (const classNode of getClassNodes(selector)) {
        const parsed = parseClassName(classNode.name, context.separatorOptions);

        if (!parsed.isBem) continue;
        if (parsed.segments[0]?.separator !== 'element') continue;
        if (context.definedClassIndex.has(parsed.block)) continue;

        stylelint.utils.report({
          message: context.message,
          messageArgs: [classNode.name, parsed.block],
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

export { checkNoOrphanedElement };
