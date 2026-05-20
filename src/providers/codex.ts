import { commandExists, spawnWithTimeout } from '../spawn';
import type { Provider } from '../types';

export class CodexProvider implements Provider {
  name = 'codex' as const;

  constructor(private readonly model?: string) {}

  isAvailable(): Promise<boolean> {
    return commandExists('codex');
  }

  call(prompt: string, opts: { timeout: number }): Promise<string> {
    const args = ['exec', '-', '--sandbox', 'read-only', '--ephemeral'];

    if (this.model) {
      args.push('--model', this.model);
    }

    return spawnWithTimeout('codex', args, {
      stdin: prompt,
      timeout: opts.timeout * 1000,
    });
  }
}
