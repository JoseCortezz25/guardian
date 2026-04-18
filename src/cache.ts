import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CacheStatus {
  valid: boolean;
  cachedFiles: number;
  size: string;
}

export interface CacheManager {
  hasPassed(fileContent: string): boolean;
  markPassed(fileContent: string): void;
  getStatus(): CacheStatus;
  clear(): void;
}

const PROJECT_CONFIG = '.guardian';
const METADATA_FILE = 'metadata.json';

function getCacheBase(): string {
  return join(process.env.HOME ?? homedir(), '.cache', 'guardian');
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getDirectorySize(dirPath: string): number {
  if (!existsSync(dirPath)) {
    return 0;
  }

  return readdirSync(dirPath).reduce((total, entry) => {
    const entryPath = join(dirPath, entry);
    const stats = statSync(entryPath);

    return total + (stats.isDirectory() ? getDirectorySize(entryPath) : stats.size);
  }, 0);
}

function getContextHash(cwd: string, rulesFile: string): string {
  const rulesContent = readIfExists(join(cwd, rulesFile));
  const projectConfigContent = readIfExists(join(cwd, PROJECT_CONFIG));
  return sha256(`${rulesContent}\n${projectConfigContent}`);
}

function getProjectCacheDir(cwd: string): string {
  return join(getCacheBase(), sha256(cwd));
}

function initializeProjectCache(projectCacheDir: string, contextHash: string): void {
  mkdirSync(join(projectCacheDir, 'files'), { recursive: true });
  writeFileSync(join(projectCacheDir, METADATA_FILE), JSON.stringify({ contextHash }, null, 2));
}

function cleanupProjectCache(projectCacheDir: string): void {
  rmSync(projectCacheDir, { recursive: true, force: true });
}

function getCachedFilesCount(filesDir: string): number {
  return existsSync(filesDir) ? readdirSync(filesDir).length : 0;
}

export function createCacheManager(cwd: string, rulesFile: string, enabled: boolean): CacheManager {
  if (!enabled) {
    return {
      hasPassed: () => false,
      markPassed: () => undefined,
      getStatus: () => ({ valid: false, cachedFiles: 0, size: '0 B' }),
      clear: () => undefined,
    };
  }

  const projectCacheDir = getProjectCacheDir(cwd);
  const filesDir = join(projectCacheDir, 'files');
  const metadataPath = join(projectCacheDir, METADATA_FILE);
  const contextHash = getContextHash(cwd, rulesFile);

  let valid = false;

  if (existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { contextHash?: string };
      valid = metadata.contextHash === contextHash;
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    cleanupProjectCache(projectCacheDir);
    initializeProjectCache(projectCacheDir, contextHash);
    valid = true;
  } else {
    mkdirSync(filesDir, { recursive: true });
  }

  return {
    hasPassed(fileContent: string): boolean {
      return existsSync(join(filesDir, sha256(fileContent)));
    },
    markPassed(fileContent: string): void {
      writeFileSync(join(filesDir, sha256(fileContent)), 'PASSED');
    },
    getStatus(): CacheStatus {
      return {
        valid,
        cachedFiles: getCachedFilesCount(filesDir),
        size: formatBytes(getDirectorySize(projectCacheDir)),
      };
    },
    clear(): void {
      cleanupProjectCache(projectCacheDir);
      initializeProjectCache(projectCacheDir, contextHash);
    },
  };
}

export function clearAllCache(): void {
  rmSync(getCacheBase(), { recursive: true, force: true });
}
