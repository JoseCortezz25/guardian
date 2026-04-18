import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, sep } from 'node:path';

const BLOCK_START = '# >>> guardian start >>>';
const BLOCK_END = '# <<< guardian end <<<';
const HOOK_BLOCK = `${BLOCK_START}\nnpx guardian run || exit 1\n${BLOCK_END}`;

function getHooksDir(cwd: string): string {
  try {
    const gitPath = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const resolved = isAbsolute(gitPath) ? gitPath : join(cwd, gitPath);

    // Husky v9 sets core.hooksPath to `.husky/_` (internal helper dir).
    // Actual user-facing hooks live in the parent `.husky/`.
    if (resolved.endsWith(`${sep}_`)) {
      return dirname(resolved);
    }

    return resolved;
  } catch {
    return join(cwd, '.git', 'hooks');
  }
}

function ensureTrailingNewline(content: string): string {
  return content.length === 0 || content.endsWith('\n') ? content : `${content}\n`;
}

function installHook(hookPath: string): void {
  mkdirSync(dirname(hookPath), { recursive: true });
  const existing = existsSync(hookPath) ? readFileSync(hookPath, 'utf8') : '#!/bin/sh\n';

  if (existing.includes(BLOCK_START) && existing.includes(BLOCK_END)) {
    console.warn(`[Guardian] Hook already installed in ${hookPath}`);
    chmodSync(hookPath, 0o755);
    return;
  }

  const next = `${ensureTrailingNewline(existing)}${HOOK_BLOCK}\n`;
  writeFileSync(hookPath, next, 'utf8');
  chmodSync(hookPath, 0o755);
  console.log(`[Guardian] Installed hook in ${hookPath}`);
}

function removeHookBlock(hookPath: string): void {
  if (!existsSync(hookPath)) {
    return;
  }

  const existing = readFileSync(hookPath, 'utf8');
  const blockPattern = new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`, 'g');
  const next = existing.replace(blockPattern, '').trimEnd();

  if (next.length === 0 || next === '#!/bin/sh') {
    rmSync(hookPath, { force: true });
    return;
  }

  writeFileSync(hookPath, `${next}\n`, 'utf8');
}

export async function installCommand(
  opts: { commitMsg?: boolean },
  cwd = process.cwd()
): Promise<number> {
  const hooksDir = getHooksDir(cwd);
  installHook(join(hooksDir, opts.commitMsg ? 'commit-msg' : 'pre-commit'));
  return 0;
}

export async function uninstallCommand(cwd = process.cwd()): Promise<number> {
  const hooksDir = getHooksDir(cwd);
  removeHookBlock(join(hooksDir, 'pre-commit'));
  removeHookBlock(join(hooksDir, 'commit-msg'));
  console.log('[Guardian] Removed Guardian hook blocks.');
  return 0;
}
