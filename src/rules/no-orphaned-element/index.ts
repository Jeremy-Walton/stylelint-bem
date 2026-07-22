import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { buildDefinedClassIndexForFile } from '../../utils/project-scan.js';
import {
  bemOrphanOptionsSchema,
  resolveKnownBlocks,
  resolveSeparatorOptions,
} from '../../utils/rule-options.js';
import type { BemOrphanOptions } from '../../utils/rule-options.js';
import {
  forEachBemClass,
  isDefinedOrKnown,
  reportBemViolation,
  validateBemOptions,
} from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

const ruleName = 'stylelint-bem/no-orphaned-element';

const messages = stylelint.utils.ruleMessages(ruleName, {
  orphanedElement: (className: string, blockName: string) =>
    `Expected the block ".${blockName}" to be defined in the project (required by orphaned element ".${className}")`,
});

function checkNoOrphanedElement(root: Root, context: RuleContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    if (parsed.segments[0]?.separator !== 'element') return;
    if (isDefinedOrKnown(context, parsed.block, parsed.block)) return;

    reportBemViolation(context, ruleNode, classNode, messages.orphanedElement, classNode.name, parsed.block);
  });
}

const rule: stylelint.Rule<true, BemOrphanOptions> = (primary, secondaryOptions) => {
  return async (root, result) => {
    const validOptions = validateBemOptions(
      result,
      ruleName,
      primary,
      [true],
      secondaryOptions,
      bemOrphanOptionsSchema,
    );

    if (!validOptions) return;

    const context: RuleContext = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(secondaryOptions),
      ignoreSelectors: secondaryOptions?.ignoreSelectors,
      knownBlocks: resolveKnownBlocks(secondaryOptions),
      definedClassIndex: await buildDefinedClassIndexForFile(root),
      messages,
    };

    checkNoOrphanedElement(root, context);
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
