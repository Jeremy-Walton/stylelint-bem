import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';

function useTmpProjects(): () => Promise<string> {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tmpDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  return async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stylelint-bem-'));
    tmpDirs.push(dir);
    return dir;
  };
}

export { useTmpProjects };
