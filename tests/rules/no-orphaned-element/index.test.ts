import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import stylelint from 'stylelint';
import { afterEach, describe, expect, it } from 'vitest';
import { testRule } from '@tests/test-utils/test-rule.js';
import plugin, { messages, ruleName } from '@src/rules/no-orphaned-element/index.js';

testRule({
  plugin,
  ruleName,
  config: true,
  accept: [
    {
      description: 'block and element defined as separate top-level rules',
      code: '.card {} .card__title {}',
    },
    {
      description: 'element nested inside its block',
      code: '.card { .card__title {} }',
    },
    {
      description: 'element with a trailing modifier, block defined',
      code: '.card {} .card__title--large {}',
    },
    {
      description: 'non-BEM class (no separators) is never checked',
      code: '.foo {}',
    },
  ],
  reject: [
    {
      description: 'element defined with no matching block anywhere in the file',
      code: '.card__title {}',
      warnings: [{ message: messages.orphanedElement('card__title', 'card') }],
    },
    {
      description: 'double-nested element name still needs its leading block defined',
      code: '.card__header__title {}',
      warnings: [{ message: messages.orphanedElement('card__header__title', 'card') }],
    },
    {
      description: 'element nested under an unrelated block does not satisfy the check',
      code: '.nav { .card__title {} }',
      warnings: [{ message: messages.orphanedElement('card__title', 'card') }],
    },
    {
      description: 'each orphaned element in a selector list is reported separately',
      code: '.card__title, .nav__title {}',
      warnings: [
        { message: messages.orphanedElement('card__title', 'card') },
        { message: messages.orphanedElement('nav__title', 'nav') },
      ],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { ignoreSelectors: ['.foo__bar'] }],
  accept: [
    {
      description: 'orphaned element matching an ignored selector is not flagged',
      code: '.foo__bar {}',
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { elementSeparator: '-' }],
  accept: [
    {
      description: 'block and element defined using a custom element separator',
      code: '.card {} .card-title {}',
    },
  ],
  reject: [
    {
      description: 'orphaned element using a custom element separator',
      code: '.card-title {}',
      warnings: [{ message: messages.orphanedElement('card-title', 'card') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: true,
  accept: [
    {
      description:
        'a class shaped like "block--modifier__element" is an invalid shape (modifiers cannot be followed by an element) and is not this check\'s concern',
      code: '.card--featured__title {}',
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: [true, { knownBlocks: ['card'] }],
  accept: [
    {
      description: 'an element of a knownBlocks entry is never flagged, even though .card is never defined',
      code: '.card__title {}',
    },
  ],
  reject: [
    {
      description: 'an element of a block not in knownBlocks is still flagged',
      code: '.nav__title {}',
      warnings: [{ message: messages.orphanedElement('nav__title', 'nav') }],
    },
  ],
});

describe(`${ruleName} — project-wide orphan scope`, () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tmpDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  async function makeProject(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stylelint-bem-rule-'));
    tmpDirs.push(dir);
    await fs.writeFile(path.join(dir, 'package.json'), '{}');
    return dir;
  }

  it('accepts an element whose block is defined in a different project file', async () => {
    const projectRoot = await makeProject();
    await fs.mkdir(path.join(projectRoot, 'shared'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'shared', 'card.css'), '.card {}');
    const pagePath = path.join(projectRoot, 'page.css');
    await fs.writeFile(pagePath, '.card__title {}');

    const result = await stylelint.lint({
      files: [pagePath],
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('still rejects a block that is not defined anywhere in the project', async () => {
    const projectRoot = await makeProject();
    const pagePath = path.join(projectRoot, 'page.css');
    await fs.writeFile(pagePath, '.ghost__title {}');

    const result = await stylelint.lint({
      files: [pagePath],
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    expect(result.results[0]!.warnings).toHaveLength(1);
    expect(result.results[0]!.warnings[0]!.text).toContain(messages.orphanedElement('ghost__title', 'ghost'));
  });

  it('uses the linted file\'s in-memory content, not a stale on-disk copy, for its own classes', async () => {
    const projectRoot = await makeProject();
    await fs.mkdir(path.join(projectRoot, 'shared'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'shared', 'card.css'), '.card {}');
    const pagePath = path.join(projectRoot, 'page.css');
    // page.css is never written to disk — codeFilename only attributes the in-memory
    // code to that path, proving project-wide scanning doesn't require re-reading the
    // file currently being linted from disk.

    const result = await stylelint.lint({
      code: '.card__title {}',
      codeFilename: pagePath,
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('falls back to same-file-only behavior when there is no file path (a raw code string)', async () => {
    const result = await stylelint.lint({
      code: '.card__title {}',
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    expect(result.results[0]!.warnings).toHaveLength(1);
  });
});
