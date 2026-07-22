import type { Root } from 'postcss';
import { getClassNames } from './selector-walker.js';

const definedClassIndexCache = new WeakMap<Root, Set<string>>();

// Cached per Root — multiple rules build a definedClassIndex over the same file.
function buildDefinedClassIndex(root: Root): Set<string> {
  const cached = definedClassIndexCache.get(root);
  if (cached) return cached;

  const defined = new Set<string>();

  root.walkRules((rule) => {
    for (const selector of rule.selectors) {
      for (const className of getClassNames(selector)) {
        defined.add(className);
      }
    }
  });

  definedClassIndexCache.set(root, defined);
  return defined;
}

export { buildDefinedClassIndex };
