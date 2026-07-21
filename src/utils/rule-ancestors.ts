import type { Rule } from 'postcss';

// At-rules (@media, @supports, ...) are transparent — they don't count as a nesting level,
// so a rule wrapped in one is still "directly under" or "nested inside" its Rule ancestors.
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
