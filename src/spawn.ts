import { spawn } from 'node:child_process';

export interface SpawnOptions {
  stdin?: string;
  timeout: number;
  cwd?: string;
}

export function spawnWithTimeout(cmd: string, args: string[], opts: SpawnOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      // On Windows, npm global CLIs are .cmd files and require shell execution
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeoutId = setTimeout(() => {
      settled = true;
      proc.kill();
      reject(
        new Error(
          `Command timed out after ${Math.ceil(opts.timeout / 1000)} seconds. Raise TIMEOUT if this command needs more time.`
        )
      );
    }, opts.timeout);

    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    proc.on('error', error => {
      clearTimeout(timeoutId);

      if (settled) {
        return;
      }

      settled = true;
      reject(
        new Error(
          `Failed to start command '${cmd}'. Is it installed and available in PATH? ${error.message}`
        )
      );
    });

    proc.on('close', code => {
      clearTimeout(timeoutId);

      if (settled) {
        return;
      }

      settled = true;

      if (code === 0) {
        resolve(stdout);
        return;
      }

      const message = stderr.trim() || `Command '${cmd}' exited with code ${code ?? 'unknown'}.`;
      reject(new Error(message));
    });

    if (typeof opts.stdin === 'string') {
      proc.stdin.write(opts.stdin);
    }

    proc.stdin.end();
  });
}

export function commandExists(cmd: string): Promise<boolean> {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';

  return new Promise(resolve => {
    const proc = spawn(lookupCommand, [cmd], {
      stdio: ['ignore', 'ignore', 'ignore'],
      shell: process.platform === 'win32',
    });

    proc.on('error', () => resolve(false));
    proc.on('close', code => resolve(code === 0));
  });
}
