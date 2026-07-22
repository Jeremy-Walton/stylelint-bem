import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { lastSegment, parentClassName } from '../../utils/bem-parser.js';
import { buildDefinedClassIndexForFile } from '../../utils/project-scan.js';
import { bemOrphanOptionsSchema, resolveKnownBlocks } from '../../utils/rule-options.js';
import type { BemOrphanOptions } from '../../utils/rule-options.js';
import { checkOrphan, createBemRule } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

const ruleName = 'stylelint-bem/no-orphaned-modifier';

const messages = stylelint.utils.ruleMessages(ruleName, {
  orphanedModifier: (className: string, targetName: string) =>
    `Expected ".${targetName}" to be defined in the project (required by orphaned modifier ".${className}")`,
});

function checkNoOrphanedModifier(root: Root, context: RuleContext): void {
  checkOrphan(
    root,
    context,
    (parsed) => lastSegment(parsed)?.separator === 'modifier',
    (parsed, separatorOptions) => parentClassName(parsed, separatorOptions),
    messages.orphanedModifier,
  );
}

const rule = createBemRule<true, BemOrphanOptions>({
  ruleName,
  messages,
  possiblePrimary: [true],
  secondarySchema: bemOrphanOptionsSchema,
  buildContext: async (secondaryOptions, root) => ({
    knownBlocks: resolveKnownBlocks(secondaryOptions),
    definedClassIndex: await buildDefinedClassIndexForFile(root),
  }),
  check: checkNoOrphanedModifier,
});

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
