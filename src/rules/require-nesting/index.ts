import stylelint from 'stylelint';
import type { Root, Rule } from 'postcss';
import { formatClassName } from '../../utils/bem-parser.js';
import { findAncestorRules } from '../../utils/rule-ancestors.js';
import { bemBaseOptionsSchema, isString, resolveSeparatorOptions } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { getClassNodes } from '../../utils/selector-walker.js';
import { forEachBemClass, reportBemViolation } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

type RequireNestingMode = 'strict' | 'weak';

const ruleName = 'stylelint-bem/require-nesting';

const messages = stylelint.utils.ruleMessages(ruleName, {
  elementNotFullSelector: (className: string) =>
    `Expected element ".${className}" to be its own full selector, not compounded with '&'`,
  elementNotNested: (className: string, blockName: string) =>
    `Expected element ".${className}" to be nested (at any depth) inside its block ".${blockName}" via native CSS nesting`,
  modifierNotCompound: (className: string) =>
    `Expected modifier ".${className}" to be a compound selector with '&' (e.g. "&.${className}")`,
  modifierNotNestedDirectly: (className: string, targetName: string) =>
    `Expected modifier ".${className}" to be nested directly inside ".${targetName}" via native CSS nesting`,
});

function ruleHasBareMatch(ruleNode: Rule, className: string): boolean {
  return ruleNode.selectors.some((selector) =>
    getClassNodes(selector).some((node) => node.nestingShape === 'bare' && node.name === className),
  );
}

function checkRequireNesting(root: Root, context: RuleContext, mode: RequireNestingMode): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    const ancestorRules = findAncestorRules(ruleNode);

    // Weak mode only validates nesting when the author actually attempted it (there's at
    // least one ancestor rule). A class with no ancestor at all is left unchecked — the
    // common case being a page/feature file adding a modifier or element onto a block that's
    // defined (and nested) in a different, shared file, which strict mode can never satisfy.
    if (mode === 'weak' && ancestorRules.length === 0) return;

    const lastSegment = parsed.segments[parsed.segments.length - 1]!;
    const expectedParentName = formatClassName(
      parsed.block,
      parsed.segments.slice(0, -1),
      context.separatorOptions,
    );

    if (lastSegment.separator === 'modifier') {
      if (classNode.nestingShape !== 'ampersand') {
        reportBemViolation(context, ruleNode, classNode, messages.modifierNotCompound, classNode.name);
        return;
      }

      const parentRule = ancestorRules[0];
      if (!parentRule || !ruleHasBareMatch(parentRule, expectedParentName)) {
        reportBemViolation(
          context,
          ruleNode,
          classNode,
          messages.modifierNotNestedDirectly,
          classNode.name,
          expectedParentName,
        );
      }
      return;
    }

    if (classNode.nestingShape !== 'bare') {
      reportBemViolation(context, ruleNode, classNode, messages.elementNotFullSelector, classNode.name);
      return;
    }

    const isNested = ancestorRules.some((ancestor) => ruleHasBareMatch(ancestor, expectedParentName));

    if (!isNested) {
      reportBemViolation(
        context,
        ruleNode,
        classNode,
        messages.elementNotNested,
        classNode.name,
        expectedParentName,
      );
    }
  });
}

function isRequireNestingPrimary(value: unknown): value is true | RequireNestingMode {
  return value === true || (isString(value) && (value === 'strict' || value === 'weak'));
}

function resolveRequireNestingMode(primary: true | RequireNestingMode): RequireNestingMode {
  return primary === 'weak' ? 'weak' : 'strict';
}

const rule: stylelint.Rule<true | RequireNestingMode, BemBaseOptions> = (primary, secondaryOptions) => {
  return async (root, result) => {
    const validPrimary = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [isRequireNestingPrimary],
    });

    if (!validPrimary) return;

    const validSecondary = stylelint.utils.validateOptions(result, ruleName, {
      actual: secondaryOptions,
      possible: bemBaseOptionsSchema,
      optional: true,
    });

    if (!validSecondary) return;

    const context: RuleContext = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(secondaryOptions),
      ignoreSelectors: secondaryOptions?.ignoreSelectors,
      messages,
    };

    checkRequireNesting(root, context, resolveRequireNestingMode(primary));
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
