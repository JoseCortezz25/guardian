import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearAllCache, createCacheManager } from '../src/cache';

const originalEnv = { ...process.env };
const createdDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  process.env = { ...originalEnv };

  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('createCacheManager', () => {
  it('stores passed entries by file content hash', () => {
    const homeDir = createTempDir('guardian-home-');
    const projectDir = createTempDir('guardian-project-');
    process.env.HOME = homeDir;

    writeFileSync(join(projectDir, 'AGENTS.md'), 'rules');
    writeFileSync(join(projectDir, '.guardian'), 'CACHE="true"');

    const cache = createCacheManager(projectDir, 'AGENTS.md', true);

    expect(cache.hasPassed('const value = 1;')).toBe(false);
    cache.markPassed('const value = 1;');
    expect(cache.hasPassed('const value = 1;')).toBe(true);
    expect(cache.getStatus()).toMatchObject({ valid: true, cachedFiles: 1 });
  });

  it('resets the project cache when rules content changes', () => {
    const homeDir = createTempDir('guardian-home-');
    const projectDir = createTempDir('guardian-project-');
    process.env.HOME = homeDir;

    const rulesPath = join(projectDir, 'AGENTS.md');
    writeFileSync(rulesPath, 'rules v1');
    writeFileSync(join(projectDir, '.guardian'), 'CACHE="true"');

    const initial = createCacheManager(projectDir, 'AGENTS.md', true);
    initial.markPassed('const value = 1;');
    expect(initial.hasPassed('const value = 1;')).toBe(true);

    writeFileSync(rulesPath, 'rules v2');

    const next = createCacheManager(projectDir, 'AGENTS.md', true);
    expect(next.hasPassed('const value = 1;')).toBe(false);
    expect(next.getStatus()).toMatchObject({ valid: true, cachedFiles: 0 });
  });

  it('clears all cache data', () => {
    const homeDir = createTempDir('guardian-home-');
    const projectDir = createTempDir('guardian-project-');
    process.env.HOME = homeDir;

    writeFileSync(join(projectDir, 'AGENTS.md'), 'rules');
    writeFileSync(join(projectDir, '.guardian'), 'CACHE="true"');

    createCacheManager(projectDir, 'AGENTS.md', true).markPassed('const value = 1;');
    expect(existsSync(join(homeDir, '.cache', 'guardian'))).toBe(true);

    clearAllCache();
    expect(existsSync(join(homeDir, '.cache', 'guardian'))).toBe(false);
  });
});
