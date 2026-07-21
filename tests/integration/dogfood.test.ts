import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import plugin, { messages, ruleName } from '@src/rules/stylelint-bem/index.js';

const fixturesDir = fileURLToPath(new URL('./fixtures/components', import.meta.url));

describe('end-to-end dogfood — a realistic component library', () => {
  it('matches the exact expected violations per file', async () => {
    const result = await stylelint.lint({
      files: [path.join(fixturesDir, '**/*.css')],
      config: {
        plugins: [plugin],
        rules: {
          [ruleName]: {
            knownBlocks: ['react-select'],
            ignoreSelectors: [/^\.js-/],
          },
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

    // Order follows check-registration order (noOrphanedElement, noOrphanedModifier, validName,
    // noDoubleNestedElement, requireNesting), then document order within each check — not
    // source position — since every violation is reported by the same single rule.
    expect(byFile.get(path.join('pages', 'dashboard.css'))).toEqual([
      messages.orphanedModifier('widget--compact', 'widget'),
      messages.invalidName('card__Header'),
      messages.doubleNestedElement('card__header__title', 'card__title'),
      messages.elementAfterModifier('card--featured__title'),
      messages.modifierNotCompound('btn--jumbo'),
      messages.modifierNotCompound('widget--compact'),
      messages.elementNotNested('card__Header', 'card'),
      messages.elementNotNested('card__header__title', 'card__header'),
      messages.elementNotNested('card--featured__title', 'card--featured'),
    ]);

    expect(byFile.get(path.join('pages', 'settings.css'))).toEqual([
      messages.elementNotNested('react-select__control', 'react-select'),
    ]);
  });
});
