import type { Plugin } from 'stylelint';
import validName from './rules/valid-name/index.js';
import noOrphanedElement from './rules/no-orphaned-element/index.js';
import noOrphanedModifier from './rules/no-orphaned-modifier/index.js';
import noDoubleNestedElement from './rules/no-double-nested-element/index.js';
import requireNesting from './rules/require-nesting/index.js';

const plugins: Plugin[] = [
  validName,
  noOrphanedElement,
  noOrphanedModifier,
  noDoubleNestedElement,
  requireNesting,
];

export default plugins;
