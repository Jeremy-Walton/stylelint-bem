import type { Rule } from 'postcss';

// At-rules (@media, @supports, ...) are transparent — skipped without counting as a nesting level.
function findAncestorRules(node: Rule): Rule[] {
  const rules: Rule[] = [];
  let current = node.parent;

  while (current && current.type !== 'root') {
    if (current.type === 'rule') rules.push(current as Rule);
    current = current.parent;
  }

  return rules;
}

export { findAncestorRules };
