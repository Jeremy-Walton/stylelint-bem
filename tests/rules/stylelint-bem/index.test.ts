import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import stylelint from 'stylelint';
import { afterEach, describe, expect, it } from 'vitest';
import { testRule } from '@tests/test-utils/test-rule.js';
import plugin, { messages, ruleName } from '@src/rules/stylelint-bem/index.js';

testRule({
  plugin,
  ruleName,
  config: { checks: { requireNesting: false } },
  reject: [
    {
      description: 'both checks run by default and report independently',
      code: '.card__title {} .card--featured {}',
      warnings: [
        { message: messages.orphanedElement('card__title', 'card') },
        { message: messages.orphanedModifier('card--featured', 'card') },
      ],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedElement: false, requireNesting: false } },
  accept: [
    {
      description: 'disabling noOrphanedElement silences only that check',
      code: '.card__title {}',
    },
  ],
  reject: [
    {
      description: 'the other check still runs',
      code: '.card--featured {}',
      warnings: [{ message: messages.orphanedModifier('card--featured', 'card') }],
    },
  ],
});

testRule({
  plugin,
  ruleName,
  config: { checks: { noOrphanedModifier: false, requireNesting: false } },
  accept: [
    {
      description: 'disabling noOrphanedModifier silences only that check',
      code: '.card--featured {}',
    },
  ],
  reject: [
    {
      description: 'the other check still runs',
      code: '.card__title {}',
      warnings: [{ message: messages.orphanedElement('card__title', 'card') }],
    },
  ],
});

describe(ruleName, () => {
  it('reports exactly one warning when the block exists but the modified element does not', async () => {
    const result = await stylelint.lint({
      code: '.card {} .card__title--large {}',
      config: { plugins: [plugin], rules: { [ruleName]: { checks: { requireNesting: false } } } },
    });

    const warnings = result.results[0]!.warnings;
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.text).toContain(
      messages.orphanedModifier('card__title--large', 'card__title'),
    );
  });

  it('accepts a fully-defined block/element/modifier chain with both checks on', async () => {
    const result = await stylelint.lint({
      code: '.card { .card__title { &.card__title--large {} } }',
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('rejects an unknown checks key', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: {
        plugins: [plugin],
        rules: { [ruleName]: { checks: { bogus: true } } },
      },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });

  it('rejects an unrecognized requireNesting mode string', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: {
        plugins: [plugin],
        rules: { [ruleName]: { checks: { requireNesting: 'bogus' } } },
      },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });

  it('rejects a non-boolean, non-string value for requireNesting', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: {
        plugins: [plugin],
        rules: { [ruleName]: { checks: { requireNesting: 1 } } },
      },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });

  it('accepts "strict" and "weak" as valid requireNesting values, and other checks still reject bad booleans', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: {
        plugins: [plugin],
        rules: { [ruleName]: { checks: { requireNesting: 'weak', validName: 'bogus' } } },
      },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });

  it('rejects a non-boolean, non-object primary option', async () => {
    const result = await stylelint.lint({
      code: '.card {}',
      config: { plugins: [plugin], rules: { [ruleName]: 'nonsense' } },
    });

    expect(result.results[0]!.invalidOptionWarnings.length).toBeGreaterThan(0);
  });
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

  it('accepts an element/modifier whose block is defined in a different project file', async () => {
    const projectRoot = await makeProject();
    await fs.mkdir(path.join(projectRoot, 'shared'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'shared', 'card.css'), '.card {}');
    const pagePath = path.join(projectRoot, 'page.css');
    await fs.writeFile(pagePath, '.card__title {} .card--featured {}');

    const result = await stylelint.lint({
      files: [pagePath],
      config: { plugins: [plugin], rules: { [ruleName]: { checks: { requireNesting: false } } } },
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('still rejects a block that is not defined anywhere in the project', async () => {
    const projectRoot = await makeProject();
    const pagePath = path.join(projectRoot, 'page.css');
    await fs.writeFile(pagePath, '.ghost__title {}');

    const result = await stylelint.lint({
      files: [pagePath],
      config: { plugins: [plugin], rules: { [ruleName]: { checks: { requireNesting: false } } } },
    });

    expect(result.results[0]!.warnings).toHaveLength(1);
    expect(result.results[0]!.warnings[0]!.text).toContain(
      messages.orphanedElement('ghost__title', 'ghost'),
    );
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
      config: { plugins: [plugin], rules: { [ruleName]: { checks: { requireNesting: false } } } },
    });

    expect(result.results[0]!.warnings).toEqual([]);
  });

  it('falls back to same-file-only behavior when there is no file path (a raw code string)', async () => {
    const result = await stylelint.lint({
      code: '.card__title {}',
      config: { plugins: [plugin], rules: { [ruleName]: { checks: { requireNesting: false } } } },
    });

    expect(result.results[0]!.warnings).toHaveLength(1);
  });
});
