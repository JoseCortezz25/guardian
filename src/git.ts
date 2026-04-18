import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import micromatch from 'micromatch';

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
}

function filterFiles(files: string[], filePatterns: string[], excludePatterns: string[]): string[] {
  const included = micromatch(files, filePatterns);
  const excluded = micromatch(included, excludePatterns);
  const excludedSet = new Set(excluded);

  return included.filter((file: string) => !excludedSet.has(file));
}

function parseGitFileList(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function getStagedFiles(
  filePatterns: string[],
  excludePatterns: string[],
  cwd = process.cwd()
): string[] {
  const files = parseGitFileList(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACM'], cwd));
  return filterFiles(files, filePatterns, excludePatterns);
}

export function getFileContent(filePath: string, cwd = process.cwd()): string {
  try {
    return runGit(['show', `:${filePath}`], cwd);
  } catch {
    return '';
  }
}

export function getPRFiles(
  baseBranch: string,
  filePatterns: string[],
  excludePatterns: string[],
  cwd = process.cwd()
): string[] {
  const files = parseGitFileList(runGit(['diff', '--name-only', '--diff-filter=ACM', `${baseBranch}...HEAD`], cwd));
  return filterFiles(files, filePatterns, excludePatterns);
}

export function detectBaseBranch(cwd = process.cwd()): string {
  for (const branch of ['main', 'master', 'develop']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', branch], {
        cwd,
        stdio: 'ignore'
      });
      return branch;
    } catch {
      // Try the next common base branch name.
    }
  }

  return 'main';
}

export function getCommitMessage(commitMsgFile: string): string {
  try {
    return readFileSync(commitMsgFile, 'utf8').trim();
  } catch {
    return '';
  }
}
