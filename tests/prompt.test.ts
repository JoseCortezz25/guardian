import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPrompt, resolveRulesFile } from '../src/prompt';

const createdDirs: string[] = [];

function createTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'guardian-prompt-'));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();

  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveRulesFile', () => {
  it('loads the rules file and appends existing markdown references', async () => {
    const projectDir = createTempProject();
    mkdirSync(join(projectDir, 'docs'), { recursive: true });
    writeFileSync(join(projectDir, 'AGENTS.md'), 'Base rules with `docs/extra.md`.');
    writeFileSync(join(projectDir, 'docs', 'extra.md'), 'Extra guidance.');

    expect(await resolveRulesFile('AGENTS.md', projectDir)).toBe(
      'Base rules with `docs/extra.md`.\n\n### docs/extra.md\n\nExtra guidance.'
    );
  });

  it('warns when a referenced markdown file is missing', async () => {
    const projectDir = createTempProject();
    writeFileSync(join(projectDir, 'AGENTS.md'), 'Base rules with `missing.md`.');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(resolveRulesFile('AGENTS.md', projectDir)).resolves.toBe(
      'Base rules with `missing.md`.'
    );
    expect(warn).toHaveBeenCalledWith('[Guardian] ⚠ Referencia no encontrada: missing.md');
  });

  it('throws a helpful error when the rules file does not exist', async () => {
    const projectDir = createTempProject();

    await expect(resolveRulesFile('AGENTS.md', projectDir)).rejects.toThrow(/AGENTS\.md/);
    await expect(resolveRulesFile('AGENTS.md', projectDir)).rejects.toThrow(/touch AGENTS\.md/);
  });
});

describe('buildPrompt', () => {
  it('includes standards, files, commit message, and strict status instructions', () => {
    const prompt = buildPrompt(
      'Rule 1',
      [{ path: 'src/example.ts', content: 'export const value = 1;' }],
      'feat: test prompt'
    );

    expect(prompt).toContain('## Coding Standards\nRule 1');
    expect(prompt).toContain('## Files To Review\n### src/example.ts');
    expect(prompt).toContain('## Commit Message\nfeat: test prompt');
    expect(prompt).toContain(
      'Your response must start with exactly STATUS: PASSED or STATUS: FAILED.'
    );
  });
});
