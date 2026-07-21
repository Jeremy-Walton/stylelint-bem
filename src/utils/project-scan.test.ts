import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import postcss from 'postcss';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findProjectRoot,
  scanProjectDefinedClasses,
  scanProjectDefinedClassesForFile,
} from './project-scan.js';

const tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stylelint-bem-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('findProjectRoot', () => {
  it('finds a package.json in the starting directory', async () => {
    const root = await makeTmpDir();
    await fs.writeFile(path.join(root, 'package.json'), '{}');

    expect(findProjectRoot(root)).toBe(root);
  });

  it('walks upward to find the nearest package.json', async () => {
    const root = await makeTmpDir();
    await fs.writeFile(path.join(root, 'package.json'), '{}');
    const nested = path.join(root, 'src', 'components');
    await fs.mkdir(nested, { recursive: true });

    expect(findProjectRoot(nested)).toBe(root);
  });

  it('stops at the nearest package.json in a monorepo, not the workspace root', async () => {
    const workspaceRoot = await makeTmpDir();
    await fs.writeFile(path.join(workspaceRoot, 'package.json'), '{}');
    const packageDir = path.join(workspaceRoot, 'packages', 'foo');
    await fs.mkdir(packageDir, { recursive: true });
    await fs.writeFile(path.join(packageDir, 'package.json'), '{}');
    const nested = path.join(packageDir, 'src');
    await fs.mkdir(nested, { recursive: true });

    expect(findProjectRoot(nested)).toBe(packageDir);
  });

  it('returns null when no package.json is found', async () => {
    const root = await makeTmpDir();
    const nested = path.join(root, 'a', 'b', 'c');
    await fs.mkdir(nested, { recursive: true });

    expect(findProjectRoot(nested)).toBeNull();
  });
});

describe('scanProjectDefinedClasses', () => {
  it('indexes classes defined across multiple project files', async () => {
    const root = await makeTmpDir();
    await fs.writeFile(path.join(root, 'button.css'), '.btn {}');
    await fs.mkdir(path.join(root, 'nested'), { recursive: true });
    await fs.writeFile(path.join(root, 'nested', 'card.css'), '.card { .card__title {} }');

    const classes = await scanProjectDefinedClasses(root);

    expect(classes).toEqual(new Set(['btn', 'card', 'card__title']));
  });

  it('excludes node_modules', async () => {
    const root = await makeTmpDir();
    await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(root, 'node_modules', 'vendor.css'), '.vendor {}');
    await fs.writeFile(path.join(root, 'app.css'), '.app {}');

    const classes = await scanProjectDefinedClasses(root);

    expect(classes).toEqual(new Set(['app']));
  });

  it('does not follow symlinked directories', async () => {
    const root = await makeTmpDir();
    const outsideDir = await makeTmpDir();
    await fs.writeFile(path.join(outsideDir, 'linked.css'), '.linked-block {}');
    await fs.symlink(outsideDir, path.join(root, 'linked'), 'dir');
    await fs.writeFile(path.join(root, 'app.css'), '.app {}');

    const classes = await scanProjectDefinedClasses(root);

    expect(classes).toEqual(new Set(['app']));
  });

  it('skips files that fail to parse instead of throwing', async () => {
    const root = await makeTmpDir();
    await fs.writeFile(path.join(root, 'broken.css'), '.broken {');
    await fs.writeFile(path.join(root, 'good.css'), '.good {}');

    const classes = await scanProjectDefinedClasses(root);

    expect(classes).toEqual(new Set(['good']));
  });

  it('caches the scan for a given project root', async () => {
    const root = await makeTmpDir();
    await fs.writeFile(path.join(root, 'one.css'), '.a {}');

    const first = await scanProjectDefinedClasses(root);
    expect(first).toEqual(new Set(['a']));

    await fs.writeFile(path.join(root, 'two.css'), '.b {}');
    const second = await scanProjectDefinedClasses(root);

    expect(second).toEqual(new Set(['a']));
  });
});

describe('scanProjectDefinedClassesForFile', () => {
  it('returns an empty set when the root has no file path (e.g. linting a raw code string)', async () => {
    const root = postcss.parse('.card {}');

    expect(await scanProjectDefinedClassesForFile(root)).toEqual(new Set());
  });

  it('returns an empty set when no project root can be found', async () => {
    const dir = await makeTmpDir();
    const filePath = path.join(dir, 'a', 'b', 'page.css');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const root = postcss.parse('.card__title {}', { from: filePath });

    expect(await scanProjectDefinedClassesForFile(root)).toEqual(new Set());
  });

  it('scans the project the linted file belongs to', async () => {
    const projectRoot = await makeTmpDir();
    await fs.writeFile(path.join(projectRoot, 'package.json'), '{}');
    await fs.mkdir(path.join(projectRoot, 'shared'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'shared', 'card.css'), '.card {}');

    const filePath = path.join(projectRoot, 'page.css');
    const root = postcss.parse('.card__title {}', { from: filePath });

    expect(await scanProjectDefinedClassesForFile(root)).toEqual(new Set(['card']));
  });
});
