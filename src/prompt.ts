import { access, readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { StagedFile } from './types';

const MARKDOWN_REF_PATTERN = /`([^`]+\.md)`/g;

async function findFileInDir(dir: string, filename: string): Promise<string | null> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isFile() && entry.name === filename) return fullPath;
    if (entry.isDirectory()) {
      const found = await findFileInDir(fullPath, filename);
      if (found) return found;
    }
  }

  return null;
}

export async function resolveRulesFile(rulesPath: string, cwd = process.cwd()): Promise<string> {
  const absolutePath = join(cwd, rulesPath);

  try {
    await access(absolutePath);
  } catch {
    throw new Error(
      `[Guardian] No se encontro el archivo de reglas en '${rulesPath}'. Crea tu guia en AGENTS.md y prueba, por ejemplo, con 'touch AGENTS.md'.`
    );
  }

  let rules = await readFile(absolutePath, 'utf8');
  const rulesDir = dirname(absolutePath);

  for (const match of rules.matchAll(MARKDOWN_REF_PATTERN)) {
    const ref = match[1];
    const directPath = join(rulesDir, ref);

    let resolvedPath: string | null = null;

    try {
      await access(directPath);
      resolvedPath = directPath;
    } catch {
      resolvedPath = await findFileInDir(rulesDir, basename(ref));
    }

    if (resolvedPath) {
      const refContent = await readFile(resolvedPath, 'utf8');
      rules += `\n\n### ${ref}\n\n${refContent}`;
    } else {
      console.warn(`[Guardian] ⚠ Referencia no encontrada: ${ref}`);
    }
  }

  return rules;
}

export function buildPrompt(rules: string, files: StagedFile[], commitMessage?: string): string {
  const fileCount = files.length;
  const fence = '```';

  const sections = [
    'You are a senior code reviewer tasked with enforcing project coding standards.',
    '',
    '## Coding Standards',
    rules.trim(),
    '',
    `## Files To Review (${fileCount} file${fileCount === 1 ? '' : 's'})`,
    files.map(file => `### ${file.path}\n\n${fence}\n${file.content}\n${fence}`).join('\n\n'),
  ];

  if (commitMessage) {
    sections.push('', '## Commit Message', commitMessage.trim());
  }

  sections.push(
    '',
    '## Instructions',
    `Review the ${fileCount === 1 ? 'file' : `${fileCount} files`} above against every rule in the Coding Standards section.`,
    'Apply each rule strictly. Do not skip any rule. Do not evaluate files not listed above.',
    '',
    'Your response MUST begin with exactly one of these two lines (no leading text, no formatting):',
    'STATUS: PASSED',
    'STATUS: FAILED',
    '',
    'Use STATUS: PASSED only when NO violations are found across ALL reviewed files.',
    'Use STATUS: FAILED when at least one violation is found in any file.',
    '',
    'After STATUS: FAILED, list each violation in this format:',
    '- **<file path>**: <rule violated> — <brief description of the issue>',
    '',
    'Do not add any text before the STATUS line.'
  );

  return sections.join('\n');
}
