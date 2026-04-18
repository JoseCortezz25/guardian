import { commandExists, spawnWithTimeout } from '../spawn';
import type { Provider } from '../types';

export class OpencodeProvider implements Provider {
  name = 'opencode' as const;

  constructor(private readonly model?: string) {}

  isAvailable(): Promise<boolean> {
    return commandExists('opencode');
  }

  call(prompt: string, opts: { timeout: number }): Promise<string> {
    const args = ['run', prompt];

    if (this.model) {
      args.push('--model', this.model);
    }

    return spawnWithTimeout('opencode', args, {
      timeout: opts.timeout * 1000,
    });
  }
}
