import { spawnSync } from 'node:child_process';

export async function addSkillsCommand(): Promise<number> {
  console.log('[Guardian] Installing Guardian skills for your AI provider...');

  const result = spawnSync('npx', ['skills', 'add', 'JoseCortezz25/guardian'], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.error) {
    console.error(`[Guardian] ✖ Failed to run npx: ${result.error.message}`);
    return 1;
  }

  if (result.status !== 0) {
    console.error('[Guardian] ✖ Skills installation failed.');
    return 1;
  }

  console.log('[Guardian] ✔ Guardian skills installed successfully.');
  return 0;
}
