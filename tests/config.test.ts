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
      filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      excludePatterns: ['*.test.ts', '*.spec.ts', '*.d.ts', '*.stories.tsx'],
      rulesFile: 'AGENTS.md',
      strictMode: true,
      timeout: 300,
      cache: true
    });
  });

  it('loads project config values from .guardian', () => {
    const projectDir = createTempProject();
    writeFileSync(
      join(projectDir, '.guardian'),
      ['PROVIDER="gemini"', 'RULES_FILE="TEAM_AGENTS.md"', 'TIMEOUT="120"', 'STRICT_MODE="false"'].join('\n')
    );

    expect(loadConfig(projectDir)).toMatchObject({
      provider: 'gemini',
      rulesFile: 'TEAM_AGENTS.md',
      timeout: 120,
      strictMode: false
    });
  });

  it('applies env vars over project and global config', () => {
    const homeDir = createTempProject();
    const projectDir = createTempProject();
    mkdirSync(join(homeDir, '.config', 'guardian'), { recursive: true });

    writeFileSync(join(homeDir, '.config', 'guardian', 'config'), 'RULES_FILE="GLOBAL.md"\nTIMEOUT="111"');
    writeFileSync(join(projectDir, '.guardian'), 'RULES_FILE="PROJECT.md"\nTIMEOUT="222"\nSTRICT_MODE="true"');

    process.env.HOME = homeDir;
    process.env.GUARDIAN_RULES_FILE = 'ENV.md';
    process.env.GUARDIAN_TIMEOUT = '333';
    process.env.GUARDIAN_STRICT_MODE = 'false';

    expect(loadConfig(projectDir)).toMatchObject({
      rulesFile: 'ENV.md',
      timeout: 333,
      strictMode: false
    });
  });

  it('parses FILE_PATTERNS as a comma-separated list', () => {
    const projectDir = createTempProject();
    writeFileSync(projectDir + '/.guardian', 'FILE_PATTERNS="src/**/*.ts,src/**/*.tsx, scripts/*.js"');

    expect(loadConfig(projectDir).filePatterns).toEqual(['src/**/*.ts', 'src/**/*.tsx', 'scripts/*.js']);
  });

  it('splits provider model at the first colon', () => {
    const projectDir = createTempProject();
    writeFileSync(projectDir + '/.guardian', 'PROVIDER="opencode:anthropic/claude-opus-4"');

    expect(loadConfig(projectDir)).toMatchObject({
      provider: 'opencode',
      providerModel: 'anthropic/claude-opus-4'
    });
  });
});
