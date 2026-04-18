export type ProviderName = 'claude' | 'gemini' | 'opencode';

export interface GuardianConfig {
  provider: ProviderName;
  providerModel?: string;
  filePatterns: string[];
  excludePatterns: string[];
  rulesFile: string;
  strictMode: boolean;
  timeout: number;
  prBaseBranch?: string;
  cache: boolean;
}

export type ReviewStatus = 'PASSED' | 'FAILED' | 'AMBIGUOUS';

export interface ReviewResult {
  status: ReviewStatus;
  violations?: string;
  raw?: string;
}

export interface StagedFile {
  path: string;
  content: string;
}

export interface CacheEntry {
  fileHash: string;
  status: 'PASSED';
}

export interface Provider {
  name: ProviderName;
  isAvailable(): Promise<boolean>;
  call(prompt: string, opts: { timeout: number }): Promise<string>;
}
