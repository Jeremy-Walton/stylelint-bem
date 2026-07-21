import stylelint from 'stylelint';
import { formatClassName, parseClassName } from '../../utils/bem-parser.js';
import { buildDefinedClassIndex } from '../../utils/block-index.js';
import { isIgnoredSelector, resolveSeparatorOptions, secondaryOptionsSchema } from '../../utils/rule-options.js';
import { getClassNodes } from '../../utils/selector-walker.js';
import type { BemSecondaryOptions } from '../../utils/rule-options.js';

const ruleName = 'plugin/stylelint-bem-no-orphaned-modifier';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (className: string, targetName: string) =>
    `Expected ".${targetName}" to be defined in this file (required by orphaned modifier ".${className}")`,
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
    const definedClassIndex = buildDefinedClassIndex(root);

    root.walkRules((ruleNode) => {
      for (const selector of ruleNode.selectors) {
        if (isIgnoredSelector(selector, secondaryOptions?.ignoreSelectors)) continue;

        for (const classNode of getClassNodes(selector)) {
          const parsed = parseClassName(classNode.name, separatorOptions);

          if (!parsed.isBem) continue;

          const lastSegment = parsed.segments[parsed.segments.length - 1];
          if (lastSegment?.separator !== 'modifier') continue;

          const target = formatClassName(
            parsed.block,
            parsed.segments.slice(0, -1),
            separatorOptions,
          );

          if (definedClassIndex.has(target)) continue;

          stylelint.utils.report({
            message: messages.rejected,
            messageArgs: [classNode.name, target],
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
