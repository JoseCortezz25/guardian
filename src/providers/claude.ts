import { commandExists, spawnWithTimeout } from '../spawn';
import type { Provider } from '../types';

export class ClaudeProvider implements Provider {
  name = 'claude' as const;

  isAvailable(): Promise<boolean> {
    return commandExists('claude');
  }

  call(prompt: string, opts: { timeout: number }): Promise<string> {
    return spawnWithTimeout('claude', ['--print'], {
      stdin: prompt,
      timeout: opts.timeout * 1000,
    });
  }
}
