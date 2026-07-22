import stylelint from 'stylelint';
import type { PostcssResult, RuleMessage, RuleOptions, RuleOptionsPossible } from 'stylelint';
import type { Root, Rule } from 'postcss';
import { parseClassName } from '../../utils/bem-parser.js';
import type { BemSeparatorOptions, ParsedBemClassName } from '../../utils/bem-parser.js';
import { isIgnoredSelector, resolveSeparatorOptions } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { getClassNodesBySelectorGroup } from '../../utils/selector-walker.js';
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
    for (const { selector, classNodes } of getClassNodesBySelectorGroup(ruleNode.selector)) {
      if (isIgnoredSelector(selector, context.ignoreSelectors)) continue;

      for (const classNode of classNodes) {
        const parsed = parseClassName(classNode.name, context.separatorOptions);
        visit(ruleNode, classNode, parsed);
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

// Shared shape behind no-orphaned-element/no-orphaned-modifier: flag a BEM segment whose target
// isn't defined anywhere in the project.
function checkOrphan(
  root: Root,
  context: RuleContext,
  isCandidate: (parsed: ParsedBemClassName) => boolean,
  targetOf: (parsed: ParsedBemClassName, separatorOptions: BemSeparatorOptions) => string,
  message: RuleMessage,
): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    if (!isCandidate(parsed)) return;

    const target = targetOf(parsed, context.separatorOptions);
    if (isDefinedOrKnown(context, parsed.block, target)) return;

    reportBemViolation(context, ruleNode, classNode, message, classNode.name, target);
  });
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

// The common shape behind every stylelint-bem rule: validate options, resolve a RuleContext, then
// run the rule-specific check. buildContext supplies anything beyond the base RuleContext fields
// (e.g. an orphan rule's knownBlocks/definedClassIndex); primary is passed through to check
// unparsed so rules with a non-boolean primary option (e.g. require-nesting's mode) can resolve it
// themselves.
function createBemRule<Primary, Options extends BemBaseOptions>(config: {
  ruleName: string;
  messages: Record<string, RuleMessage>;
  possiblePrimary: RuleOptions['possible'];
  secondarySchema: Record<string, RuleOptionsPossible[]>;
  buildContext?: (secondaryOptions: Options | undefined, root: Root) => Promise<Partial<RuleContext>> | Partial<RuleContext>;
  check: (root: Root, context: RuleContext, primary: Primary) => void;
}): stylelint.Rule<Primary, Options> {
  const rule: stylelint.Rule<Primary, Options> = (primary, secondaryOptions) => async (root, result) => {
    const validOptions = validateBemOptions(
      result,
      config.ruleName,
      primary,
      config.possiblePrimary,
      secondaryOptions,
      config.secondarySchema,
    );

    if (!validOptions) return;

    const extraContext = (await config.buildContext?.(secondaryOptions, root)) ?? {};

    const context: RuleContext = {
      ruleName: config.ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(secondaryOptions),
      ignoreSelectors: secondaryOptions?.ignoreSelectors,
      messages: config.messages,
      ...extraContext,
    };

    config.check(root, context, primary);
  };

  rule.ruleName = config.ruleName;
  rule.messages = config.messages;

  return rule;
}

export type { RuleContext };
export {
  forEachClass,
  forEachBemClass,
  reportBemViolation,
  isDefinedOrKnown,
  checkOrphan,
  validateBemOptions,
  createBemRule,
};
