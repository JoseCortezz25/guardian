import type { ReviewResult } from './types';

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;
const STATUS_PATTERN = /^\**\s*status\s*:\s*(passed|failed)\s*\**$/i;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

export function parseResponse(rawOutput: string): ReviewResult {
  const cleaned = stripAnsi(rawOutput).trim();
  const lines = cleaned.split(/\r?\n/).slice(0, 15);

  for (const line of lines) {
    const match = line.trim().match(STATUS_PATTERN);

    if (!match) {
      continue;
    }

    if (match[1].toUpperCase() === 'PASSED') {
      return { status: 'PASSED' };
    }

    return {
      status: 'FAILED',
      violations: cleaned
    };
  }

  return {
    status: 'AMBIGUOUS',
    raw: cleaned
  };
}
