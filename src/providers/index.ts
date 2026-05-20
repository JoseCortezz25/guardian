import type { GuardianConfig, Provider } from '../types';
import { ClaudeProvider } from './claude';
import { CodexProvider } from './codex';
import { GeminiProvider } from './gemini';
import { OpencodeProvider } from './opencode';

export function getProvider(config: GuardianConfig): Provider {
  switch (config.provider) {
    case 'claude':
      return new ClaudeProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'opencode':
      return new OpencodeProvider(config.providerModel);
    case 'codex':
      return new CodexProvider(config.providerModel);
    default:
      throw new Error(
        `[Guardian] Unknown provider '${String(config.provider)}'. Expected one of: claude, gemini, opencode, codex.`
      );
  }
}
