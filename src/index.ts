import type { Plugin } from 'stylelint';
import noOrphanedElement from './rules/no-orphaned-element/index.js';
import noOrphanedModifier from './rules/no-orphaned-modifier/index.js';

const plugins: Plugin[] = [noOrphanedElement, noOrphanedModifier];

export default plugins;
