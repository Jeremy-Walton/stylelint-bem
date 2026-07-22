import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { lastSegment, parentClassName } from '../../utils/bem-parser.js';
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

const ruleName = 'stylelint-bem/no-orphaned-modifier';

const messages = stylelint.utils.ruleMessages(ruleName, {
  orphanedModifier: (className: string, targetName: string) =>
    `Expected ".${targetName}" to be defined in the project (required by orphaned modifier ".${className}")`,
});

function checkNoOrphanedModifier(root: Root, context: RuleContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    if (lastSegment(parsed)?.separator !== 'modifier') return;

    const target = parentClassName(parsed, context.separatorOptions);

    if (isDefinedOrKnown(context, parsed.block, target)) return;

    reportBemViolation(context, ruleNode, classNode, messages.orphanedModifier, classNode.name, target);
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

    checkNoOrphanedModifier(root, context);
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
