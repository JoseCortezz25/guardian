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
  const sections = [
    'You are reviewing code changes against the project rules below.',
    '',
    '## Coding Standards',
    rules.trim(),
    '',
    '## Files To Review',
    files
      .map(file => `### ${file.path}\n\n\u0060\u0060\u0060\n${file.content}\n\u0060\u0060\u0060`)
      .join('\n\n'),
  ];

  if (commitMessage) {
    sections.push('', '## Commit Message', commitMessage.trim());
  }

  sections.push(
    '',
    '## Instructions',
    'Review only the files shown above.',
    'Apply the coding standards strictly.',
    'Respond with STATUS: PASSED when there are no violations.',
    'Respond with STATUS: FAILED when you find any violation.',
    'Your response must start with exactly STATUS: PASSED or STATUS: FAILED.',
    'When failing, include a concise list of violations and the affected files.'
  );

  return sections.join('\n');
}
