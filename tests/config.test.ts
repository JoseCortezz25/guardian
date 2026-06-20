import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const originalEnv = { ...process.env };
const createdDirs: string[] = [];

function createTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'guardian-'));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  process.env = { ...originalEnv };

  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadConfig', () => {
  it('returns defaults when no config exists', () => {
    const projectDir = createTempProject();

    expect(loadConfig(projectDir)).toEqual({
      provider: 'claude',
      filePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      excludePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/*.d.ts', '**/*.stories.tsx'],
      rulesFile: 'AGENTS.md',
      strictMode: true,
      timeout: 300,
      cache: true,
      batchSize: 20,
    });
  });

  it('loads project config values from .guardian', () => {
    const projectDir = createTempProject();
    writeFileSync(
      join(projectDir, '.guardian'),
      [
        'PROVIDER="gemini"',
        'RULES_FILE="TEAM_AGENTS.md"',
        'TIMEOUT="120"',
        'STRICT_MODE="false"',
      ].join('\n')
    );

    expect(loadConfig(projectDir)).toMatchObject({
      provider: 'gemini',
      rulesFile: 'TEAM_AGENTS.md',
      timeout: 120,
      strictMode: false,
    });
  });

  it('applies env vars over project and global config', () => {
    const homeDir = createTempProject();
    const projectDir = createTempProject();
    mkdirSync(join(homeDir, '.config', 'guardian'), { recursive: true });

    writeFileSync(
      join(homeDir, '.config', 'guardian', 'config'),
      'RULES_FILE="GLOBAL.md"\nTIMEOUT="111"'
    );
    writeFileSync(
      join(projectDir, '.guardian'),
      'RULES_FILE="PROJECT.md"\nTIMEOUT="222"\nSTRICT_MODE="true"'
    );

    process.env.HOME = homeDir;
    process.env.GUARDIAN_RULES_FILE = 'ENV.md';
    process.env.GUARDIAN_TIMEOUT = '333';
    process.env.GUARDIAN_STRICT_MODE = 'false';

    expect(loadConfig(projectDir)).toMatchObject({
      rulesFile: 'ENV.md',
      timeout: 333,
      strictMode: false,
    });
  });

  it('parses FILE_PATTERNS as a comma-separated list', () => {
    const projectDir = createTempProject();
    writeFileSync(
      projectDir + '/.guardian',
      'FILE_PATTERNS="src/**/*.ts,src/**/*.tsx, scripts/*.js"'
    );

    expect(loadConfig(projectDir).filePatterns).toEqual([
      'src/**/*.ts',
      'src/**/*.tsx',
      'scripts/*.js',
    ]);
  });

  it('splits provider model at the first colon', () => {
    const projectDir = createTempProject();
    writeFileSync(projectDir + '/.guardian', 'PROVIDER="opencode:anthropic/claude-opus-4"');

    expect(loadConfig(projectDir)).toMatchObject({
      provider: 'opencode',
      providerModel: 'anthropic/claude-opus-4',
    });
  });

  describe('.guardianignore', () => {
    it('excludePatterns unchanged when .guardianignore does not exist', () => {
      const projectDir = createTempProject();

      expect(loadConfig(projectDir).excludePatterns).toEqual([
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/*.stories.tsx',
      ]);
    });

    it('merges .guardianignore patterns with existing excludePatterns', () => {
      const projectDir = createTempProject();
      writeFileSync(join(projectDir, '.guardianignore'), 'src/generated/**\ndist/**');

      expect(loadConfig(projectDir).excludePatterns).toEqual([
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/*.stories.tsx',
        'src/generated/**',
        'dist/**',
      ]);
    });

    it('ignores comment lines and blank lines in .guardianignore', () => {
      const projectDir = createTempProject();
      writeFileSync(
        join(projectDir, '.guardianignore'),
        ['# this is a comment', '', 'src/legacy/**', '', '# another comment', 'build/**'].join('\n')
      );

      expect(loadConfig(projectDir).excludePatterns).toContain('src/legacy/**');
      expect(loadConfig(projectDir).excludePatterns).toContain('build/**');
      expect(loadConfig(projectDir).excludePatterns).not.toContain('# this is a comment');
      expect(loadConfig(projectDir).excludePatterns).not.toContain('');
    });

    it('.guardianignore patterns add to EXCLUDE_PATTERNS from .guardian, not replace', () => {
      const projectDir = createTempProject();
      writeFileSync(join(projectDir, '.guardian'), 'EXCLUDE_PATTERNS="**/*.snap"');
      writeFileSync(join(projectDir, '.guardianignore'), 'src/generated/**');

      expect(loadConfig(projectDir).excludePatterns).toEqual(['**/*.snap', 'src/generated/**']);
    });

    it('treats # mid-line as part of the pattern, not a comment', () => {
      const projectDir = createTempProject();
      writeFileSync(join(projectDir, '.guardianignore'), 'src/file#name.ts');

      expect(loadConfig(projectDir).excludePatterns).toContain('src/file#name.ts');
    });
  });
});
