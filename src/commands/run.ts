import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import micromatch from 'micromatch';
import { createCacheManager } from '../cache';
import { loadConfig } from '../config';
import { detectBaseBranch, getFileContent, getPRFiles, getStagedFiles } from '../git';
import { parseResponse } from '../parser';
import { buildPrompt, resolveRulesFile } from '../prompt';
import { getProvider } from '../providers';
import type { StagedFile } from '../types';

export interface RunOptions {
  noCache?: boolean;
  prMode?: boolean;
  ci?: boolean;
}

function getWorkingTreeContent(filePath: string, cwd: string): string {
  const absolutePath = join(cwd, filePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

function handleOperationalError(message: string, strictMode: boolean): number {
  if (strictMode) {
    console.error(`[Guardian] ${message}`);
    return 1;
  }

  console.warn(`[Guardian] ${message}`);
  return 0;
}

function getCiFiles(filePatterns: string[], excludePatterns: string[], cwd: string): string[] {
  const output = execSync('git diff --name-only --diff-filter=ACM HEAD~1..HEAD', {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });

  const files = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const included = micromatch(files, filePatterns);
  const excluded = new Set(micromatch(included, excludePatterns));
  return included.filter((file) => !excluded.has(file));
}

export async function runCommand(opts: RunOptions, cwd = process.cwd()): Promise<number> {
  const config = loadConfig(cwd);
  const cacheEnabled = config.cache && !opts.noCache;
  const provider = getProvider(config);

  console.log('[Guardian] Running Guardian review');
  console.log(`[Guardian] Provider: ${provider.name}`);
  console.log(`[Guardian] Rules file: ${config.rulesFile}`);
  console.log(`[Guardian] Cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  if (!(await provider.isAvailable())) {
    return handleOperationalError(`Provider '${provider.name}' is not available in PATH.`, config.strictMode);
  }

  let files: string[];

  if (opts.prMode) {
    files = getPRFiles(config.prBaseBranch ?? detectBaseBranch(cwd), config.filePatterns, config.excludePatterns, cwd);
  } else if (opts.ci) {
    files = getCiFiles(config.filePatterns, config.excludePatterns, cwd);
  } else {
    files = getStagedFiles(config.filePatterns, config.excludePatterns, cwd);
  }

  if (files.length === 0) {
    console.log('[Guardian] No files to review.');
    return 0;
  }

  const cache = createCacheManager(cwd, config.rulesFile, cacheEnabled);
  const filesToReview: StagedFile[] = [];

  for (const filePath of files) {
    const content = getFileContent(filePath, cwd) || getWorkingTreeContent(filePath, cwd);

    if (!content) {
      continue;
    }

    if (cache.hasPassed(content)) {
      continue;
    }

    filesToReview.push({ path: filePath, content });
  }

  if (filesToReview.length === 0) {
    console.log('[Guardian] All matching files are already cached as PASSED.');
    return 0;
  }

  let rules: string;

  try {
    rules = await resolveRulesFile(config.rulesFile, cwd);
  } catch (error) {
    return handleOperationalError(error instanceof Error ? error.message : 'Failed to load rules file.', config.strictMode);
  }

  const prompt = buildPrompt(rules, filesToReview);

  let rawResponse: string;

  try {
    rawResponse = await provider.call(prompt, { timeout: config.timeout });
  } catch (error) {
    return handleOperationalError(error instanceof Error ? error.message : 'Provider request failed.', config.strictMode);
  }

  const result = parseResponse(rawResponse);

  if (result.status === 'PASSED') {
    for (const file of filesToReview) {
      cache.markPassed(file.content);
    }

    console.log(`[Guardian] PASSED (${filesToReview.length} file${filesToReview.length === 1 ? '' : 's'} reviewed)`);
    return 0;
  }

  if (result.status === 'FAILED') {
    console.error(result.violations ?? '[Guardian] Review failed with no details.');
    return 1;
  }

  const ambiguousMessage = result.raw ? `Ambiguous provider response:\n${result.raw}` : 'Ambiguous provider response.';
  return handleOperationalError(ambiguousMessage, config.strictMode);
}
