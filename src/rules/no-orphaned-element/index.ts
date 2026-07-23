import stylelint from 'stylelint';
import type { Root } from 'postcss';
import { checkOrphan, createOrphanRule } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

const ruleName = 'stylelint-bem/no-orphaned-element';

const messages = stylelint.utils.ruleMessages(ruleName, {
  orphanedElement: (className: string, blockName: string) =>
    `Expected the block ".${blockName}" to be defined in the project (required by orphaned element ".${className}")`,
});

function checkNoOrphanedElement(root: Root, context: RuleContext): void {
  checkOrphan(
    root,
    context,
    (parsed) => parsed.segments[0]?.separator === 'element',
    (parsed) => parsed.block,
    messages.orphanedElement,
  );
}

const rule = createOrphanRule({
  ruleName,
  messages,
  check: checkNoOrphanedElement,
});

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
