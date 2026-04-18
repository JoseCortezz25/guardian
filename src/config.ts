import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { GuardianConfig, ProviderName } from './types';

const DEFAULTS: GuardianConfig = {
  provider: 'claude',
  filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
  excludePatterns: ['*.test.ts', '*.spec.ts', '*.d.ts', '*.stories.tsx'],
  rulesFile: 'AGENTS.md',
  strictMode: true,
  timeout: 300,
  cache: true
};

type RawConfig = Partial<
  Record<
    | 'PROVIDER'
    | 'FILE_PATTERNS'
    | 'EXCLUDE_PATTERNS'
    | 'RULES_FILE'
    | 'STRICT_MODE'
    | 'TIMEOUT'
    | 'PR_BASE_BRANCH'
    | 'CACHE',
    string
  >
>;

function parseList(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseProvider(value: string | undefined): Pick<GuardianConfig, 'provider' | 'providerModel'> | undefined {
  if (!value) {
    return undefined;
  }

  const [providerPart, ...modelParts] = value.split(':');
  const provider = providerPart?.trim() as ProviderName | undefined;

  if (provider !== 'claude' && provider !== 'gemini' && provider !== 'opencode') {
    return undefined;
  }

  const providerModel = modelParts.length > 0 ? modelParts.join(':').trim() : undefined;
  return providerModel ? { provider, providerModel } : { provider };
}

function parseConfigFile(filePath: string): RawConfig {
  if (!existsSync(filePath)) {
    return {};
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  const parsed: RawConfig = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Z_]+)=(?:"([\s\S]*)"|(.*))$/);

    if (!match) {
      continue;
    }

    const key = match[1] as keyof RawConfig;

    if (!(key in {
      PROVIDER: true,
      FILE_PATTERNS: true,
      EXCLUDE_PATTERNS: true,
      RULES_FILE: true,
      STRICT_MODE: true,
      TIMEOUT: true,
      PR_BASE_BRANCH: true,
      CACHE: true
    })) {
      continue;
    }

    parsed[key] = (match[2] ?? match[3] ?? '').trim();
  }

  return parsed;
}

function mapEnvConfig(env: NodeJS.ProcessEnv): RawConfig {
  const parsed: RawConfig = {};

  if (env.GUARDIAN_PROVIDER) {
    parsed.PROVIDER = env.GUARDIAN_PROVIDER;
  }

  if (env.GUARDIAN_TIMEOUT) {
    parsed.TIMEOUT = env.GUARDIAN_TIMEOUT;
  }

  if (env.GUARDIAN_STRICT_MODE) {
    parsed.STRICT_MODE = env.GUARDIAN_STRICT_MODE;
  }

  if (env.GUARDIAN_RULES_FILE) {
    parsed.RULES_FILE = env.GUARDIAN_RULES_FILE;
  }

  if (env.GUARDIAN_CACHE) {
    parsed.CACHE = env.GUARDIAN_CACHE;
  }

  return parsed;
}

function applyRawConfig(base: GuardianConfig, raw: RawConfig): GuardianConfig {
  const next = { ...base };
  const provider = parseProvider(raw.PROVIDER);
  const filePatterns = parseList(raw.FILE_PATTERNS);
  const excludePatterns = parseList(raw.EXCLUDE_PATTERNS);
  const strictMode = parseBoolean(raw.STRICT_MODE);
  const timeout = parseNumber(raw.TIMEOUT);
  const cache = parseBoolean(raw.CACHE);

  if (provider) {
    next.provider = provider.provider;
    next.providerModel = provider.providerModel;
  }

  if (filePatterns) {
    next.filePatterns = filePatterns;
  }

  if (excludePatterns) {
    next.excludePatterns = excludePatterns;
  }

  if (raw.RULES_FILE) {
    next.rulesFile = raw.RULES_FILE;
  }

  if (typeof strictMode === 'boolean') {
    next.strictMode = strictMode;
  }

  if (typeof timeout === 'number') {
    next.timeout = timeout;
  }

  if (raw.PR_BASE_BRANCH) {
    next.prBaseBranch = raw.PR_BASE_BRANCH;
  }

  if (typeof cache === 'boolean') {
    next.cache = cache;
  }

  return next;
}

export function loadConfig(cwd = process.cwd()): GuardianConfig {
  const globalConfigPath = join(homedir(), '.config', 'guardian', 'config');
  const projectConfigPath = join(cwd, '.guardian');

  return [parseConfigFile(globalConfigPath), parseConfigFile(projectConfigPath), mapEnvConfig(process.env)].reduce(
    (config, raw) => applyRawConfig(config, raw),
    { ...DEFAULTS }
  );
}
