import stylelint from 'stylelint';
import { parseClassName } from '../../utils/bem-parser.js';
import { buildBlockIndex } from '../../utils/block-index.js';
import { isIgnoredSelector, resolveSeparatorOptions, secondaryOptionsSchema } from '../../utils/rule-options.js';
import { getClassNodes } from '../../utils/selector-walker.js';
import type { BemSecondaryOptions } from '../../utils/rule-options.js';

const ruleName = 'plugin/stylelint-bem-no-orphaned-element';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (className: string, blockName: string) =>
    `Expected the block ".${blockName}" to be defined in this file (required by orphaned element ".${className}")`,
});

const rule: stylelint.Rule<boolean, BemSecondaryOptions> = (primary, secondaryOptions) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(
      result,
      ruleName,
      { actual: primary, possible: [true] },
      { actual: secondaryOptions, possible: secondaryOptionsSchema, optional: true },
    );

    if (!validOptions) return;

    const separatorOptions = resolveSeparatorOptions(secondaryOptions);
    const blockIndex = buildBlockIndex(root, separatorOptions);

    root.walkRules((ruleNode) => {
      for (const selector of ruleNode.selectors) {
        if (isIgnoredSelector(selector, secondaryOptions?.ignoreSelectors)) continue;

        for (const classNode of getClassNodes(selector)) {
          const parsed = parseClassName(classNode.name, separatorOptions);

          if (!parsed.isBem) continue;
          if (parsed.segments[0]?.separator !== 'element') continue;
          if (blockIndex.has(parsed.block)) continue;

          stylelint.utils.report({
            message: messages.rejected,
            messageArgs: [classNode.name, parsed.block],
            node: ruleNode,
            index: classNode.sourceIndex,
            endIndex: classNode.sourceIndex + classNode.name.length + 1,
            result,
            ruleName,
          });
        }
      }
    });
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };
