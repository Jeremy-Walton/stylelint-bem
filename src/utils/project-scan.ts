import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import scssSyntax from 'postcss-scss';
import type { Root } from 'postcss';
import { buildDefinedClassIndex } from './block-index.js';

function findProjectRoot(startDir: string): string | null {
  let dir = startDir;

  while (true) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) return null;

    dir = parent;
  }
}

const scanCache = new Map<string, Promise<Set<string>>>();

async function scanProjectDefinedClasses(projectRoot: string): Promise<Set<string>> {
  let cached = scanCache.get(projectRoot);

  if (!cached) {
    cached = performScan(projectRoot);
    scanCache.set(projectRoot, cached);
  }

  return cached;
}

async function performScan(projectRoot: string): Promise<Set<string>> {
  const files = await fg('**/*.{css,scss}', {
    cwd: projectRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/vendor/**'],
    followSymbolicLinks: false,
  });

  const classes = new Set<string>();

  await Promise.all(
    files.map(async (file) => {
      let css: string;

      try {
        css = await fs.readFile(file, 'utf8');
      } catch {
        return;
      }

      try {
        // postcss-scss is a superset of CSS, so one parser handles both without branching on
        // extension, including SCSS-only syntax (e.g. "//" comments) the CSS parser would reject.
        const root = scssSyntax.parse(css, { from: file });
        for (const className of buildDefinedClassIndex(root)) classes.add(className);
      } catch {
        // A broken file elsewhere in the project shouldn't block linting the current file.
      }
    }),
  );

  return classes;
}

async function scanProjectDefinedClassesForFile(root: Root): Promise<Set<string>> {
  const filePath = root.source?.input.file;
  if (!filePath) return new Set();

  const projectRoot = findProjectRoot(path.dirname(filePath));
  if (!projectRoot) return new Set();

  return scanProjectDefinedClasses(projectRoot);
}

// The project-wide scan's I/O and the current file's own rule walk are independent, so they run
// concurrently.
async function buildDefinedClassIndexForFile(root: Root): Promise<Set<string>> {
  const projectClassesPromise = scanProjectDefinedClassesForFile(root);
  const fileClasses = buildDefinedClassIndex(root);
  const projectClasses = await projectClassesPromise;

  const combined = new Set(projectClasses);
  for (const className of fileClasses) combined.add(className);
  return combined;
}

export {
  findProjectRoot,
  scanProjectDefinedClasses,
  scanProjectDefinedClassesForFile,
  buildDefinedClassIndexForFile,
};
