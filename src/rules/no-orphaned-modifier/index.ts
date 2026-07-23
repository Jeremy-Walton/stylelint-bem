import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { lastSegment, parentClassName } from '../../utils/bem-parser.js';
import { checkOrphan, createOrphanRule } from '../shared/rule-context.js';
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

const rule = createOrphanRule({
  ruleName,
  messages,
  check: checkNoOrphanedModifier,
});

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
