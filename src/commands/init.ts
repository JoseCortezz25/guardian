import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_CONFIG = `# Guardian project configuration
PROVIDER="claude"
RULES_FILE="AGENTS.md"
STRICT_MODE="true"
TIMEOUT="300"
CACHE="true"
`;

const DEFAULT_AGENTS = `# Guardian Rules

## Review Goals
- Keep changes small, safe, and consistent with the existing codebase.
- Prefer fixing the root cause over adding compensating complexity.
- Call out concrete violations with file-specific reasoning.

## Response Format
- Start with STATUS: PASSED when there are no issues.
- Start with STATUS: FAILED when there are issues.
- When failing, include a concise list of violations and affected files.
`;

function createFile(filePath: string, content: string): boolean {
  if (existsSync(filePath)) {
    console.warn(`[Guardian] Warning: '${filePath}' already exists. Skipping.`);
    return false;
  }

  writeFileSync(filePath, content, 'utf8');
  console.log(`[Guardian] Created ${filePath}`);
  return true;
}

export async function initCommand(
  rulesFile = 'AGENTS.md',
  provider = 'claude',
  cwd = process.cwd()
): Promise<number> {
  const config = DEFAULT_CONFIG.replace('PROVIDER="claude"', `PROVIDER="${provider}"`).replace(
    'RULES_FILE="AGENTS.md"',
    `RULES_FILE="${rulesFile}"`
  );

  const overwrite = (filePath: string, content: string): void => {
    writeFileSync(filePath, content, 'utf8');
  };

  const guardianPath = join(cwd, '.guardian');
  if (existsSync(guardianPath)) {
    overwrite(guardianPath, config);
  } else {
    createFile(guardianPath, config);
  }

  createFile(join(cwd, rulesFile), DEFAULT_AGENTS);

  return 0;
}
