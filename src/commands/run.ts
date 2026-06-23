import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
import { generateReport } from '../report';
import type { ReviewStatus, StagedFile } from '../types';

export interface RunOptions {
  noCache?: boolean;
  prMode?: boolean;
  ci?: boolean;
  all?: boolean;
  files?: string[];
  report?: boolean;
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

function normalizeFilePatterns(patterns: string[]): string[] {
  return patterns.map(p => (/[*?{[]/.test(p) ? p : `${p.replace(/\/$/, '')}/**`));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
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

  if (opts.files && opts.files.length > 0) {
    const normalizedPatterns = normalizeFilePatterns(opts.files);
    files = micromatch(files, normalizedPatterns);
    console.log(
      `[Guardian] Filtered to ${files.length} file${files.length === 1 ? '' : 's'} matching: ${opts.files.join(', ')}`
    );
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

  const batches = chunkArray(filesToReview, config.batchSize);
  const totalBatches = batches.length;

  if (totalBatches > 1) {
    console.log(
      `[Guardian] Processing ${totalBatches} batches of up to ${config.batchSize} files each (BATCH_SIZE configurable in .guardian)`
    );
  }

  let finalStatus: ReviewStatus = 'PASSED';
  const allViolations: string[] = [];
  const startedAt = new Date();

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    if (totalBatches > 1) {
      console.log(
        `[Guardian] Batch ${i + 1}/${totalBatches}: reviewing ${batch.length} file${batch.length === 1 ? '' : 's'}...`
      );
    }

    const prompt = buildPrompt(rules, batch);
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

    if (result.status === 'PASSED') {
      for (const file of batch) {
        cache.markPassed(file.content);
      }
      if (totalBatches > 1) {
        console.log(`[Guardian] Batch ${i + 1}/${totalBatches}: PASSED`);
      }
    } else if (result.status === 'FAILED') {
      finalStatus = 'FAILED';
      if (totalBatches > 1) {
        console.log(`[Guardian] Batch ${i + 1}/${totalBatches}: FAILED`);
      }
      if (result.violations) {
        allViolations.push(result.violations);
      }
    } else {
      if (finalStatus !== 'FAILED') {
        finalStatus = 'AMBIGUOUS';
      }
      if (totalBatches > 1) {
        console.log(`[Guardian] Batch ${i + 1}/${totalBatches}: AMBIGUOUS`);
      }
      if (result.raw) {
        allViolations.push(result.raw);
      }
    }
  }

  const combinedViolations = allViolations.length > 0 ? allViolations.join('\n\n') : undefined;

  if (opts.report) {
    try {
      const reportPath = await generateReport(
        {
          date: startedAt,
          status: finalStatus,
          provider: provider.name,
          mode,
          filesReviewed: filesToReview.length,
          totalFiles: files.length,
          violations: combinedViolations,
          batchCount: totalBatches,
        },
        cwd
      );
      console.log(`[Guardian] Report saved: ${reportPath}`);
    } catch (error) {
      console.warn(
        `[Guardian] Failed to write report: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  if (finalStatus === 'PASSED') {
    console.log(
      `[Guardian] PASSED (${filesToReview.length} file${filesToReview.length === 1 ? '' : 's'} reviewed)`
    );
    return 0;
  }

  if (finalStatus === 'FAILED') {
    console.error(combinedViolations ?? '[Guardian] Review failed with no details.');
    return 1;
  }

  const ambiguousMessage = combinedViolations
    ? `Ambiguous provider response:\n${combinedViolations}`
    : 'Ambiguous provider response.';
  return handleOperationalError(ambiguousMessage, config.strictMode);
}
