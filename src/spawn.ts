import { spawn } from 'node:child_process';
import type { SpawnResult } from './types';

export interface SpawnCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function spawnCommand(
  command: string,
  args: string[] = [],
  options: SpawnCommandOptions = {}
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}
