import stylelint from 'stylelint';
import type { PostcssResult, RuleMessage, RuleOptions, RuleOptionsPossible } from 'stylelint';
import type { Root, Rule } from 'postcss';
import { parseClassName } from '../../utils/bem-parser.js';
import type { BemSeparatorOptions, ParsedBemClassName } from '../../utils/bem-parser.js';
import { isIgnoredSelector } from '../../utils/rule-options.js';
import { getClassNodes } from '../../utils/selector-walker.js';
import type { ClassNode } from '../../utils/selector-walker.js';

interface RuleContext {
  ruleName: string;
  result: PostcssResult;
  separatorOptions: BemSeparatorOptions;
  ignoreSelectors?: (string | RegExp)[];
  definedClassIndex?: Set<string>;
  knownBlocks?: Set<string>;
  messages: Record<string, RuleMessage>;
}

function forEachClass(
  root: Root,
  context: RuleContext,
  visit: (ruleNode: Rule, classNode: ClassNode, parsed: ParsedBemClassName) => void,
): void {
  root.walkRules((ruleNode) => {
    // getClassNodes(selector) resets sourceIndex to 0 per comma-split selector; re-anchoring it to
    // each selector's real offset in ruleNode.selector keeps reported warning positions correct.
    // searchIndex advances so a repeated selector text resolves to its own occurrence.
    let searchIndex = 0;

    for (const selector of ruleNode.selectors) {
      const selectorStart = ruleNode.selector.indexOf(selector, searchIndex);
      const offset = selectorStart === -1 ? 0 : selectorStart;
      searchIndex = offset + selector.length;

      if (isIgnoredSelector(selector, context.ignoreSelectors)) continue;

      for (const classNode of getClassNodes(selector)) {
        const parsed = parseClassName(classNode.name, context.separatorOptions);
        visit(ruleNode, { ...classNode, sourceIndex: offset + classNode.sourceIndex }, parsed);
      }
    }
  });
}

function forEachBemClass(
  root: Root,
  context: RuleContext,
  visit: (ruleNode: Rule, classNode: ClassNode, parsed: ParsedBemClassName) => void,
): void {
  forEachClass(root, context, (ruleNode, classNode, parsed) => {
    if (parsed.isBem) visit(ruleNode, classNode, parsed);
  });
}

// A knownBlocks entry is trusted wherever it appears, for vendor/third-party classes that will
// never be defined in project CSS.
function isDefinedOrKnown(context: RuleContext, block: string, targetClassName: string): boolean {
  return (
    (context.knownBlocks?.has(block) ?? false) ||
    (context.definedClassIndex?.has(targetClassName) ?? false)
  );
}

function reportBemViolation(
  context: RuleContext,
  ruleNode: Rule,
  classNode: ClassNode,
  message: RuleMessage,
  ...messageArgs: string[]
): void {
  stylelint.utils.report({
    message,
    messageArgs,
    node: ruleNode,
    index: classNode.sourceIndex,
    endIndex: classNode.sourceIndex + classNode.name.length + 1,
    result: context.result,
    ruleName: context.ruleName,
  });
}

function validateBemOptions(
  result: PostcssResult,
  ruleName: string,
  primary: unknown,
  possiblePrimary: RuleOptions['possible'],
  secondaryOptions: unknown,
  secondarySchema: Record<string, RuleOptionsPossible[]>,
): boolean {
  const validPrimary = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: possiblePrimary,
  });

  if (!validPrimary) return false;

  return stylelint.utils.validateOptions(result, ruleName, {
    actual: secondaryOptions,
    possible: secondarySchema,
    optional: true,
  });
}

export type { RuleContext };
export { forEachClass, forEachBemClass, reportBemViolation, isDefinedOrKnown, validateBemOptions };
