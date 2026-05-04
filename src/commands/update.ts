import { execSync, spawnSync } from 'node:child_process';
import { version as currentVersion } from '../../package.json';

export async function updateCommand(): Promise<number> {
  console.log(`[Guardian] Current version: v${currentVersion}`);

  let latestVersion: string;
  try {
    latestVersion = execSync('npm show @ajosecortes/guardian-cli version', {
      encoding: 'utf8',
    }).trim();
  } catch {
    console.error('[Guardian] ✖ Could not fetch latest version from npm.');
    return 1;
  }

  if (latestVersion === currentVersion) {
    console.log('[Guardian] ✔ Already up to date.');
    return 0;
  }

  console.log(`[Guardian] New version available: v${latestVersion}. Updating...`);

  const result = spawnSync('npm', ['install', '-g', '@ajosecortes/guardian-cli@latest'], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.error('[Guardian] ✖ Update failed.');
    return 1;
  }

  console.log(`[Guardian] ✔ Updated to v${latestVersion}.`);
  return 0;
}
