import { commandExists, spawnWithTimeout } from '../spawn';
import type { Provider } from '../types';

export class AntigravityProvider implements Provider {
  name = 'antigravity' as const;

  constructor(private readonly model?: string) {}

  isAvailable(): Promise<boolean> {
    return commandExists('agy-agent');
  }

  call(prompt: string, opts: { timeout: number }): Promise<string> {
    const args = ['ask', prompt];

    if (this.model) {
      args.push('--model', this.model);
    }

    return spawnWithTimeout('agy-agent', args, {
      timeout: opts.timeout * 1000,
    });
  }
}
