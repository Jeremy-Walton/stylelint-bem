import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import plugins from '@src/index.js';
import { messages as validNameMessages, ruleName as validNameRule } from '@src/rules/valid-name/index.js';
import {
  messages as orphanedElementMessages,
  ruleName as noOrphanedElementRule,
} from '@src/rules/no-orphaned-element/index.js';
import {
  messages as orphanedModifierMessages,
  ruleName as noOrphanedModifierRule,
} from '@src/rules/no-orphaned-modifier/index.js';
import {
  messages as doubleNestedMessages,
  ruleName as noDoubleNestedElementRule,
} from '@src/rules/no-double-nested-element/index.js';
import {
  messages as requireNestingMessages,
  ruleName as requireNestingRule,
} from '@src/rules/require-nesting/index.js';

const messages = {
  ...validNameMessages,
  ...orphanedElementMessages,
  ...orphanedModifierMessages,
  ...doubleNestedMessages,
  ...requireNestingMessages,
};

const fixturesDir = fileURLToPath(new URL('./fixtures/components', import.meta.url));

describe('end-to-end dogfood — a realistic component library', () => {
  it('matches the exact expected violations per file', async () => {
    const result = await stylelint.lint({
      files: [path.join(fixturesDir, '**/*.css')],
      config: {
        plugins,
        rules: {
          [validNameRule]: [true, { ignoreSelectors: [/^\.js-/] }],
          [noOrphanedElementRule]: [true, { knownBlocks: ['react-select'], ignoreSelectors: [/^\.js-/] }],
          [noOrphanedModifierRule]: [true, { knownBlocks: ['react-select'], ignoreSelectors: [/^\.js-/] }],
          [noDoubleNestedElementRule]: [true, { ignoreSelectors: [/^\.js-/] }],
          [requireNestingRule]: [true, { ignoreSelectors: [/^\.js-/] }],
        },
      },
    });

    const byFile = new Map(
      result.results.map((fileResult) => [
        path.relative(fixturesDir, fileResult.source!),
        fileResult.warnings.map((warning) => warning.text),
      ]),
    );

    expect(byFile.get(path.join('shared', 'button.css'))).toEqual([]);
    expect(byFile.get(path.join('shared', 'card.css'))).toEqual([]);

    // Each rule now runs as its own stylelint rule, so cross-rule order is no longer
    // check-registration order within one rule — it's whichever rule's async function
    // resolves first. The synchronous rules (validName, noDoubleNestedElement,
    // requireNesting) settle in declaration order; the two orphan rules await a
    // project-wide file scan and so report after them, in declaration order among
    // themselves. Within a single rule, order is still document order.
    expect(byFile.get(path.join('pages', 'dashboard.css'))).toEqual([
      messages.invalidName('card__Header'),
      messages.doubleNestedElement('card__header__title', 'card__title'),
      messages.elementAfterModifier('card--featured__title'),
      messages.modifierNotCompound('btn--jumbo', 'btn'),
      messages.modifierNotCompound('widget--compact', 'widget'),
      messages.elementNotNested('card__Header', 'card'),
      messages.elementNotNested('card__header__title', 'card__header'),
      messages.elementNotNested('card--featured__title', 'card--featured'),
      messages.orphanedModifier('widget--compact', 'widget'),
    ]);

    expect(byFile.get(path.join('pages', 'settings.css'))).toEqual([
      messages.elementNotNested('react-select__control', 'react-select'),
    ]);
  });
});
