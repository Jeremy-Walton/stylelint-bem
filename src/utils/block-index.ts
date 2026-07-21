import type { Root } from 'postcss';
import { type BemSeparatorOptions, parseClassName } from './bem-parser.js';
import { getClassNames } from './selector-walker.js';

function buildDefinedClassIndex(root: Root): Set<string> {
  const defined = new Set<string>();

  root.walkRules((rule) => {
    for (const selector of rule.selectors) {
      const classNames = getClassNames(selector);
      if (classNames.length !== 1) continue;

      defined.add(classNames[0]!);
    }
  });

  return defined;
}

function buildBlockIndex(root: Root, options: BemSeparatorOptions): Set<string> {
  const blocks = new Set<string>();

  for (const className of buildDefinedClassIndex(root)) {
    if (!parseClassName(className, options).isBem) {
      blocks.add(className);
    }
  }

  return blocks;
}

export { buildBlockIndex, buildDefinedClassIndex };
