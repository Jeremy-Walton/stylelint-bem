import fs from 'node:fs/promises';
import path from 'node:path';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import { testRule } from '@tests/test-utils/test-rule.js';
import { useTmpProjects } from '@tests/test-utils/tmp-project.js';
import plugin, { messages, ruleName } from '@src/rules/no-orphaned-modifier/index.js';

testRule({
  plugin,
  ruleName,
  config: true,
  accept: [
    {
      description: 'block and modifier defined as separate top-level rules',
      code: '.card {} .card--featured {}',
    },
    {
      description: 'modifier compound-nested inside its block',
      code: '.card { &.card--featured {} }',
    },
    {
      description: 'non-BEM class (no separators) is never checked',
      code: '.foo {}',
    },
    {
      description: 'element-modifier whose immediate target (the element) is itself defined',
      code: '.card { .card__title { &.card__title--large {} } }',
    },
    {
      description:
        'modifier-then-element is an invalid shape (a modifier cannot have an element after it) — left entirely to no-double-nested-element, not checked here',
      code: '.card--featured__title {}',
    },
  ],
  reject: [
    {
      description: 'modifier defined with no matching block anywhere in the file',
      code: '.card--featured {}',
      warnings: [{ message: messages.orphanedModifier('card--featured', 'card') }],
    },
    {
      description:
        'element-modifier whose immediate target (the element) was never defined, even though the root block was',
      code: '.card {} .card__title--large {}',
      warnings: [{ message: messages.orphanedModifier('card__title--large', 'card__title') }],
    },
    {
      description: 'modifier nested under an unrelated block does not satisfy the check',
      code: '.nav { &.card--featured {} }',
      warnings: [{ message: messages.orphanedModifier('card--featured', 'card') }],
    },
    {
      description: 'each orphaned modifier in a selector list is reported separately',
      code: '.card--featured, .nav--featured {}',
      warnings: [
        { message: messages.orphanedModifier('card--featured', 'card') },
        { message: messages.orphanedModifier('nav--featured', 'nav') },
      ],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { ignoreSelectors: ['.foo--bar'] }],
  accept: [
    {
      description: 'orphaned modifier matching an ignored selector is not flagged',
      code: '.foo--bar {}',
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { modifierSeparator: '_' }],
  accept: [
    {
      description: 'block and modifier defined using a custom modifier separator',
      code: '.card {} .card_featured {}',
    },
  ],
  reject: [
    {
      description: 'orphaned modifier using a custom modifier separator',
      code: '.card_featured {}',
      warnings: [{ message: messages.orphanedModifier('card_featured', 'card') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { knownBlocks: ['card'] }],
  accept: [
    {
      description: 'a modifier of a knownBlocks entry is never flagged, even though .card is never defined',
      code: '.card--featured {}',
    },
    {
      description:
        "an element-modifier's root block being in knownBlocks also satisfies the check, even though the element itself is never defined",
      code: '.card__title--large {}',
    },
  ],
  reject: [
    {
      description: 'a modifier of a block not in knownBlocks is still flagged',
      code: '.nav--featured {}',
      warnings: [{ message: messages.orphanedModifier('nav--featured', 'nav') }],
    },
  ],
});

describe(`${ruleName} — project-wide orphan scope`, () => {
  const makeTmpDir = useTmpProjects();

  async function makeProject(): Promise<string> {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'package.json'), '{}');
    return dir;
  }

  it('accepts a modifier whose block is defined in a different project file', async () => {
    const projectRoot = await makeProject();
    await fs.mkdir(path.join(projectRoot, 'shared'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'shared', 'card.css'), '.card {}');
    const pagePath = path.join(projectRoot, 'page.css');
    await fs.writeFile(pagePath, '.card--featured {}');

    const result = await stylelint.lint({
      files: [pagePath],
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('still rejects a block that is not defined anywhere in the project', async () => {
    const projectRoot = await makeProject();
    const pagePath = path.join(projectRoot, 'page.css');
    await fs.writeFile(pagePath, '.ghost--featured {}');

    const result = await stylelint.lint({
      files: [pagePath],
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    expect(result.results[0]!.warnings).toHaveLength(1);
    expect(result.results[0]!.warnings[0]!.text).toContain(
      messages.orphanedModifier('ghost--featured', 'ghost'),
    );
  });
});
