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

export async function initCommand(cwd = process.cwd()): Promise<number> {
  createFile(join(cwd, '.guardian'), DEFAULT_CONFIG);
  createFile(join(cwd, 'AGENTS.md'), DEFAULT_AGENTS);

  console.log('[Guardian] Next steps:');
  console.log('  1. Update AGENTS.md with your project rules.');
  console.log('  2. Adjust .guardian if you need a different provider or timeout.');
  console.log('  3. Run `guardian install` to enable the git hook.');
  return 0;
}
