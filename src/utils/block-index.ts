import type { Root } from 'postcss';
import parser from 'postcss-selector-parser';
import { type BemSeparatorOptions, parseClassName } from './bem-parser.js';

function buildBlockIndex(root: Root, options: BemSeparatorOptions): Set<string> {
  const blocks = new Set<string>();

  root.walkRules((rule) => {
    for (const selector of rule.selectors) {
      const classNames: string[] = [];

      parser((selectorRoot) => {
        selectorRoot.walkClasses((classNode) => {
          classNames.push(classNode.value);
        });
      }).processSync(selector);

      if (classNames.length !== 1) continue;

      const [className] = classNames;
      if (!parseClassName(className, options).isBem) {
        blocks.add(className);
      }
    }
  });

  return blocks;
}

export { buildBlockIndex };
