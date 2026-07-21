import stylelint from 'stylelint';
import type { PostcssResult, RuleMessage } from 'stylelint';
import type { Root, Rule } from 'postcss';
import { parseClassName } from '../../utils/bem-parser.js';
import type { BemSeparatorOptions, ParsedBemClassName } from '../../utils/bem-parser.js';
import { isIgnoredSelector } from '../../utils/rule-options.js';
import { getClassNodes } from '../../utils/selector-walker.js';
import type { ClassNode } from '../../utils/selector-walker.js';

interface CheckContext {
  ruleName: string;
  result: PostcssResult;
  separatorOptions: BemSeparatorOptions;
  ignoreSelectors?: (string | RegExp)[];
  definedClassIndex: Set<string>;
  message: RuleMessage;
}

function forEachBemClass(
  root: Root,
  context: CheckContext,
  visit: (ruleNode: Rule, classNode: ClassNode, parsed: ParsedBemClassName) => void,
): void {
  root.walkRules((ruleNode) => {
    for (const selector of ruleNode.selectors) {
      if (isIgnoredSelector(selector, context.ignoreSelectors)) continue;

      for (const classNode of getClassNodes(selector)) {
        const parsed = parseClassName(classNode.name, context.separatorOptions);
        if (!parsed.isBem) continue;

        visit(ruleNode, classNode, parsed);
      }
    }
  });
}

function reportBemViolation(
  context: CheckContext,
  ruleNode: Rule,
  classNode: ClassNode,
  ...messageArgs: string[]
): void {
  stylelint.utils.report({
    message: context.message,
    messageArgs,
    node: ruleNode,
    index: classNode.sourceIndex,
    endIndex: classNode.sourceIndex + classNode.name.length + 1,
    result: context.result,
    ruleName: context.ruleName,
  });
}

export type { CheckContext };
export { forEachBemClass, reportBemViolation };
