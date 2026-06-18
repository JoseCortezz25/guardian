import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import micromatch from 'micromatch';
import { createCacheManager } from '../cache';
import { loadConfig } from '../config';
import {
  detectBaseBranch,
  getAllTrackedFiles,
  getFileContentAsync,
  getPRFiles,
  getStagedFiles,
} from '../git';
import { parseResponse } from '../parser';
import { buildPrompt, resolveRulesFile } from '../prompt';
import { getProvider } from '../providers';
import type { StagedFile } from '../types';

export interface RunOptions {
  noCache?: boolean;
  prMode?: boolean;
  ci?: boolean;
  all?: boolean;
  dir?: string;
  output?: string;
}

function buildReport(params: {
  status: 'PASSED' | 'FAILED' | 'AMBIGUOUS';
  provider: string;
  mode: string;
  dir?: string;
  rulesFile: string;
  filesReviewed: string[];
  violations?: string;
  raw?: string;
}): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [
    '# Guardian Review Report',
    '',
    `**Date:** ${timestamp}`,
    `**Provider:** ${params.provider}`,
    `**Mode:** ${params.mode}`,
    `**Rules file:** ${params.rulesFile}`,
    ...(params.dir ? [`**Directory:** ${params.dir}`] : []),
    `**Files reviewed:** ${params.filesReviewed.length}`,
    '',
    `## Status: ${params.status}`,
    '',
  ];

  if (params.status === 'FAILED' && params.violations) {
    lines.push('## Violations', '', params.violations, '');
  }

  if (params.status === 'AMBIGUOUS' && params.raw) {
    lines.push('## Response', '', params.raw, '');
  }

  lines.push('## Files Reviewed', '');
  for (const file of params.filesReviewed) {
    lines.push(`- \`${file}\``);
  }

  return lines.join('\n');
}

function getWorkingTreeContent(filePath: string, cwd: string): string {
  const absolutePath = join(cwd, filePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

async function getWorkingTreeContentAsync(filePath: string, cwd: string): Promise<string> {
  const absolutePath = join(cwd, filePath);
  try {
    return await readFile(absolutePath, 'utf8');
  } catch {
    return '';
  }
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
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  const files = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const included = micromatch(files, filePatterns);
  const excluded = new Set(micromatch(included, excludePatterns));
  return included.filter(file => !excluded.has(file));
}

export async function runCommand(opts: RunOptions, cwd = process.cwd()): Promise<number> {
  const config = loadConfig(cwd);
  const cacheEnabled = config.cache && !opts.noCache;
  const provider = getProvider(config);

  const mode = opts.all ? 'all' : opts.prMode ? 'pr' : opts.ci ? 'ci' : 'staged';
  console.log('[Guardian] Running Guardian review');
  console.log(`[Guardian] Provider: ${provider.name}`);
  console.log(`[Guardian] Rules file: ${config.rulesFile}`);
  console.log(`[Guardian] Cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);
  console.log(`[Guardian] Mode: ${mode}`);
  if (opts.dir) {
    console.log(`[Guardian] Directory filter: ${opts.dir}`);
  }

  if (!(await provider.isAvailable())) {
    return handleOperationalError(
      `Provider '${provider.name}' is not available in PATH.`,
      config.strictMode
    );
  }

  let files: string[];

  if (opts.all) {
    files = getAllTrackedFiles(config.filePatterns, config.excludePatterns, cwd);
  } else if (opts.prMode) {
    files = getPRFiles(
      config.prBaseBranch ?? detectBaseBranch(cwd),
      config.filePatterns,
      config.excludePatterns,
      cwd
    );
  } else if (opts.ci) {
    files = getCiFiles(config.filePatterns, config.excludePatterns, cwd);
  } else {
    files = getStagedFiles(config.filePatterns, config.excludePatterns, cwd);
  }

  if (opts.dir) {
    const normalizedDir = opts.dir.replace(/\\/g, '/').replace(/\/$/, '');
    files = files.filter(f => f.startsWith(`${normalizedDir}/`) || f === normalizedDir);
  }

  if (files.length === 0) {
    console.log('[Guardian] No files to review.');
    return 0;
  }

  console.log(`[Guardian] Found ${files.length} file${files.length === 1 ? '' : 's'} to process`);

  const cache = createCacheManager(cwd, config.rulesFile, cacheEnabled);

  const fileContents = await Promise.all(
    files.map(async filePath => {
      const content = opts.all
        ? await getWorkingTreeContentAsync(filePath, cwd)
        : (await getFileContentAsync(filePath, cwd)) || getWorkingTreeContent(filePath, cwd);
      return { path: filePath, content };
    })
  );

  const filesToReview: StagedFile[] = [];

  for (const { path: filePath, content } of fileContents) {
    if (!content || cache.hasPassed(content)) {
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
    return handleOperationalError(
      error instanceof Error ? error.message : 'Failed to load rules file.',
      config.strictMode
    );
  }

  const prompt = buildPrompt(rules, filesToReview);

  let rawResponse: string;

  try {
    rawResponse = await provider.call(prompt, { timeout: config.timeout });
  } catch (error) {
    return handleOperationalError(
      error instanceof Error ? error.message : 'Provider request failed.',
      config.strictMode
    );
  }

  const result = parseResponse(rawResponse);

  const reviewedPaths = filesToReview.map(f => f.path);

  function saveReport(
    status: 'PASSED' | 'FAILED' | 'AMBIGUOUS',
    violations?: string,
    raw?: string
  ): void {
    if (!opts.output) return;
    const report = buildReport({
      status,
      provider: provider.name,
      mode,
      dir: opts.dir,
      rulesFile: config.rulesFile,
      filesReviewed: reviewedPaths,
      violations,
      raw,
    });
    writeFileSync(join(cwd, opts.output), report, 'utf8');
    console.log(`[Guardian] Report saved to ${opts.output}`);
  }

  if (result.status === 'PASSED') {
    for (const file of filesToReview) {
      cache.markPassed(file.content);
    }

    console.log(
      `[Guardian] PASSED (${filesToReview.length} file${filesToReview.length === 1 ? '' : 's'} reviewed)`
    );
    saveReport('PASSED');
    return 0;
  }

  if (result.status === 'FAILED') {
    console.error(result.violations ?? '[Guardian] Review failed with no details.');
    saveReport('FAILED', result.violations);
    return 1;
  }

  const ambiguousMessage = result.raw
    ? `Ambiguous provider response:\n${result.raw}`
    : 'Ambiguous provider response.';
  saveReport('AMBIGUOUS', undefined, result.raw);
  return handleOperationalError(ambiguousMessage, config.strictMode);
}
