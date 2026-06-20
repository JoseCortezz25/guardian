import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReviewStatus } from './types';

export interface ReportData {
  date: Date;
  status: ReviewStatus;
  provider: string;
  mode: string;
  filesReviewed: number;
  totalFiles: number;
  violations?: string;
  batchCount: number;
}

function formatDatetime(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function formatDateForFilename(date: Date): string {
  return date
    .toISOString()
    .replace('T', '-')
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, '');
}

function buildReportContent(data: ReportData): string {
  const statusLabel =
    data.status === 'PASSED'
      ? '✅ PASSED'
      : data.status === 'FAILED'
        ? '❌ FAILED'
        : '⚠️ AMBIGUOUS';

  const lines: string[] = [
    '# Guardian Review Report',
    '',
    `**Date:** ${formatDatetime(data.date)}`,
    `**Status:** ${statusLabel}`,
    `**Provider:** ${data.provider}`,
    `**Mode:** ${data.mode}`,
    `**Files Reviewed:** ${data.filesReviewed}`,
  ];

  if (data.batchCount > 1) {
    lines.push(`**Batches:** ${data.batchCount}`);
  }

  lines.push('');

  if (data.status === 'PASSED') {
    lines.push('## Result', '', 'All reviewed files passed with no violations found.');
  } else if (data.status === 'FAILED') {
    lines.push('## Violations', '', data.violations ?? 'No details provided.');
  } else {
    lines.push(
      '## Result',
      '',
      'The review returned an ambiguous response — could not determine PASSED or FAILED.'
    );
  }

  return lines.join('\n') + '\n';
}

export async function generateReport(data: ReportData, cwd: string): Promise<string> {
  const reportsDir = join(cwd, 'guardian', 'reports');
  await mkdir(reportsDir, { recursive: true });

  const filename = `report-${formatDateForFilename(data.date)}.md`;
  const reportPath = join(reportsDir, filename);
  await writeFile(reportPath, buildReportContent(data), 'utf8');

  return reportPath;
}
