import { describe, expect, it } from 'vitest';
import { parseResponse } from '../src/parser';

describe('parseResponse', () => {
  it('parses PASSED status', () => {
    expect(parseResponse('STATUS: PASSED')).toEqual({ status: 'PASSED' });
  });

  it('parses FAILED status with violations', () => {
    expect(parseResponse('STATUS: FAILED\n- violation')).toEqual({
      status: 'FAILED',
      violations: 'STATUS: FAILED\n- violation',
    });
  });

  it('accepts markdown bold status lines', () => {
    expect(parseResponse('**STATUS: PASSED**')).toEqual({ status: 'PASSED' });
  });

  it('finds status within the first fifteen lines', () => {
    const raw = ['line 1', 'line 2', 'line 3', 'line 4', 'STATUS: FAILED', '- violation'].join(
      '\n'
    );

    expect(parseResponse(raw)).toEqual({
      status: 'FAILED',
      violations: raw,
    });
  });

  it('returns ambiguous when no status is present', () => {
    expect(parseResponse('No explicit status here.')).toEqual({
      status: 'AMBIGUOUS',
      raw: 'No explicit status here.',
    });
  });

  it('parses status case-insensitively', () => {
    expect(parseResponse('status: passed')).toEqual({ status: 'PASSED' });
  });

  it('strips ANSI codes before parsing', () => {
    expect(parseResponse('\u001b[31mSTATUS: FAILED\u001b[0m\nproblem')).toEqual({
      status: 'FAILED',
      violations: 'STATUS: FAILED\nproblem',
    });
  });
});
