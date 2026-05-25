import { commandExists, spawnWithTimeout } from '../spawn';
import type { Provider } from '../types';

export class GeminiProvider implements Provider {
  name = 'gemini' as const;

  isAvailable(): Promise<boolean> {
    return commandExists('gemini');
  }

  call(prompt: string, opts: { timeout: number }): Promise<string> {
    return spawnWithTimeout('gemini', [], {
      stdin: prompt,
      timeout: opts.timeout * 1000,
    });
  }
}
