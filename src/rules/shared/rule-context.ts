import stylelint from 'stylelint';
import type { PostcssResult, RuleMessage } from 'stylelint';
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

function forEachBemClass(
  root: Root,
  context: RuleContext,
  visit: (ruleNode: Rule, classNode: ClassNode, parsed: ParsedBemClassName) => void,
): void {
  root.walkRules((ruleNode) => {
    // ruleNode.selectors are the comma-split, individually trimmed pieces of the rule's own raw
    // selector text — trimming only strips leading/trailing whitespace, so each piece is still a
    // literal substring of it. getClassNodes(selector) reports sourceIndex relative to that one
    // piece alone (reset to 0 per selector), but a reported warning's index is interpreted
    // relative to the whole rule's selector text — so for every selector after the first in a
    // list, the raw sourceIndex would point at the wrong character entirely. Locating each piece's
    // true offset (searching forward so a repeated selector text resolves to its own occurrence)
    // and adding it back in keeps every reported position correct, however many selectors precede
    // the one being reported on.
    let searchIndex = 0;

    for (const selector of ruleNode.selectors) {
      const selectorStart = ruleNode.selector.indexOf(selector, searchIndex);
      const offset = selectorStart === -1 ? 0 : selectorStart;
      searchIndex = offset + selector.length;

      if (isIgnoredSelector(selector, context.ignoreSelectors)) continue;

      for (const classNode of getClassNodes(selector)) {
        const parsed = parseClassName(classNode.name, context.separatorOptions);
        if (!parsed.isBem) continue;

        visit(ruleNode, { ...classNode, sourceIndex: offset + classNode.sourceIndex }, parsed);
      }
    }
  });
}

// A block in knownBlocks is trusted wherever it appears — as a root block, or as the
// block an element/modifier's immediate target belongs to — for vendor/third-party
// classes that will never be defined in any project CSS file.
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

export type { RuleContext };
export { forEachBemClass, reportBemViolation, isDefinedOrKnown };
