import { describe, expect, it } from 'vitest';
import { getProvider } from '../src/providers';
import type { GuardianConfig } from '../src/types';

const baseConfig: GuardianConfig = {
  provider: 'claude',
  filePatterns: ['*.ts'],
  excludePatterns: [],
  rulesFile: 'AGENTS.md',
  strictMode: true,
  timeout: 300,
  cache: true,
};

describe('getProvider', () => {
  it('returns the configured provider instance', () => {
    expect(getProvider(baseConfig).name).toBe('claude');
    expect(getProvider({ ...baseConfig, provider: 'gemini' }).name).toBe('gemini');
    expect(getProvider({ ...baseConfig, provider: 'opencode', providerModel: 'o3' }).name).toBe(
      'opencode'
    );
  });

  it('throws for an unknown provider', () => {
    expect(() =>
      getProvider({ ...baseConfig, provider: 'unknown' as GuardianConfig['provider'] })
    ).toThrow(/Unknown provider/);
  });
});
