import stylelint from 'stylelint';
import type { Root, Rule } from 'postcss';
import { isKebabCase } from '../../utils/bem-parser.js';
import { bemBaseOptionsSchema } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { createBemRule, forEachClass, reportBemViolation } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';
import type { ClassNode } from '../../utils/selector-walker.js';

const ruleName = 'stylelint-bem/valid-name';

const messages = stylelint.utils.ruleMessages(ruleName, {
  invalidName: (className: string) =>
    `Expected all parts of ".${className}" to be kebab-case (lowercase letters, digits, and single dashes)`,
});

// A bare class (no separator) is checked as a block name too, but only once some BEM element or
// modifier elsewhere in the file marks it as an actual block — otherwise it's indistinguishable
// from an unrelated plain/utility class, which this rule must never flag.
function checkValidName(root: Root, context: RuleContext): void {
  const referencedBlocks = new Set<string>();
  const bareClasses: { ruleNode: Rule; classNode: ClassNode }[] = [];

  forEachClass(root, context, (ruleNode, classNode, parsed) => {
    if (!parsed.isBem) {
      bareClasses.push({ ruleNode, classNode });
      return;
    }

    referencedBlocks.add(parsed.block);

    const isValid =
      isKebabCase(parsed.block) && parsed.segments.every((segment) => isKebabCase(segment.name));

    if (!isValid) reportBemViolation(context, ruleNode, classNode, messages.invalidName, classNode.name);
  });

  for (const { ruleNode, classNode } of bareClasses) {
    if (!referencedBlocks.has(classNode.name)) continue;
    if (isKebabCase(classNode.name)) continue;

    reportBemViolation(context, ruleNode, classNode, messages.invalidName, classNode.name);
  }
}

const rule = createBemRule<true, BemBaseOptions>({
  ruleName,
  messages,
  possiblePrimary: [true],
  secondarySchema: bemBaseOptionsSchema,
  check: checkValidName,
});

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
