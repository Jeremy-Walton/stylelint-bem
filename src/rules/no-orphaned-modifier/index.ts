import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { formatClassName } from '../../utils/bem-parser.js';
import { buildDefinedClassIndex } from '../../utils/block-index.js';
import { scanProjectDefinedClassesForFile } from '../../utils/project-scan.js';
import {
  bemOrphanOptionsSchema,
  resolveKnownBlocks,
  resolveSeparatorOptions,
} from '../../utils/rule-options.js';
import type { BemOrphanOptions } from '../../utils/rule-options.js';
import { forEachBemClass, isDefinedOrKnown, reportBemViolation } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

const ruleName = 'stylelint-bem/no-orphaned-modifier';

const messages = stylelint.utils.ruleMessages(ruleName, {
  orphanedModifier: (className: string, targetName: string) =>
    `Expected ".${targetName}" to be defined in the project (required by orphaned modifier ".${className}")`,
});

function checkNoOrphanedModifier(root: Root, context: RuleContext): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    const lastSegment = parsed.segments[parsed.segments.length - 1];
    if (lastSegment?.separator !== 'modifier') return;

    const target = formatClassName(parsed.block, parsed.segments.slice(0, -1), context.separatorOptions);

    if (isDefinedOrKnown(context, parsed.block, target)) return;

    reportBemViolation(context, ruleNode, classNode, messages.orphanedModifier, classNode.name, target);
  });
}

const rule: stylelint.Rule<true, BemOrphanOptions> = (primary, secondaryOptions) => {
  return async (root, result) => {
    const validPrimary = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });

    if (!validPrimary) return;

    const validSecondary = stylelint.utils.validateOptions(result, ruleName, {
      actual: secondaryOptions,
      possible: bemOrphanOptionsSchema,
      optional: true,
    });

    if (!validSecondary) return;

    const projectClasses = await scanProjectDefinedClassesForFile(root);

    const context: RuleContext = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(secondaryOptions),
      ignoreSelectors: secondaryOptions?.ignoreSelectors,
      knownBlocks: resolveKnownBlocks(secondaryOptions),
      definedClassIndex: new Set([...projectClasses, ...buildDefinedClassIndex(root)]),
      messages,
    };

    checkNoOrphanedModifier(root, context);
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
