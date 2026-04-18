import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { StagedFile } from './types';

const MARKDOWN_REF_PATTERN = /`([^`]+\.md)`/g;

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
    const refPath = join(rulesDir, ref);

    try {
      await access(refPath);
      const refContent = await readFile(refPath, 'utf8');
      rules += `\n\n### ${ref}\n\n${refContent}`;
    } catch {
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
    files.map((file) => `### ${file.path}\n\n\u0060\u0060\u0060\n${file.content}\n\u0060\u0060\u0060`).join('\n\n')
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
