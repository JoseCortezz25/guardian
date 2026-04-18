import { createCacheManager, clearAllCache } from '../cache';
import { loadConfig } from '../config';

export async function cacheStatusCommand(cwd = process.cwd()): Promise<number> {
  const config = loadConfig(cwd);
  const status = createCacheManager(cwd, config.rulesFile, true).getStatus();

  console.log(`[Guardian] Cache valid: ${status.valid ? 'yes' : 'no'}`);
  console.log(`[Guardian] Cached files: ${status.cachedFiles}`);
  console.log(`[Guardian] Size: ${status.size}`);
  return 0;
}

export async function cacheClearCommand(cwd = process.cwd()): Promise<number> {
  const config = loadConfig(cwd);
  createCacheManager(cwd, config.rulesFile, true).clear();
  console.log('[Guardian] Cleared project cache.');
  return 0;
}

export async function cacheClearAllCommand(): Promise<number> {
  clearAllCache();
  console.log('[Guardian] Cleared all Guardian cache.');
  return 0;
}
