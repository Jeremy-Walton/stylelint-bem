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
    ignore: ['**/node_modules/**'],
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
        // postcss-scss parses plain CSS fine too (it's a superset), so using it for every
        // matched file — not just .scss — avoids branching on extension while still handling
        // SCSS-only syntax (e.g. "//" line comments) that would crash the default CSS parser.
        const root = scssSyntax.parse(css, { from: file });
        for (const className of buildDefinedClassIndex(root)) classes.add(className);
      } catch {
        // Skip files that fail to parse — a broken file elsewhere in the project
        // shouldn't prevent linting the file currently being checked.
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

export { findProjectRoot, scanProjectDefinedClasses, scanProjectDefinedClassesForFile };
