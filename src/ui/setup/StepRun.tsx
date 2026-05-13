import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { StepIndicator } from '../shared/StepIndicator';
import { StatusLine } from '../shared/StatusLine';
import { getStagedFiles } from '../../git';
import { loadConfig } from '../../config';
import { runCommand } from '../../commands/run';

const CONFIRM = [
  { label: 'Yes, run now', value: 'yes' },
  { label: 'No, exit', value: 'no' },
];

interface StepRunProps {
  onComplete: () => void;
}

type Phase = 'checking' | 'confirm' | 'running' | 'done' | 'skipped';
type RunStatus = 'passed' | 'failed' | null;

export function StepRun({ onComplete }: StepRunProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [stagedFiles, setStagedFiles] = useState<string[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus>(null);

  useEffect(() => {
    void (async () => {
      const config = loadConfig();
      const files = getStagedFiles(config.filePatterns, config.excludePatterns);
      if (files.length === 0) {
        setPhase('skipped');
        onComplete();
      } else {
        setStagedFiles(files);
        setPhase('confirm');
      }
    })();
  }, []);

  async function handleConfirm(item: { value: string }) {
    if (item.value === 'no') {
      onComplete();
      return;
    }

    setPhase('running');
    const code = await runCommand({});
    setRunStatus(code === 0 ? 'passed' : 'failed');
    setPhase('done');
    onComplete();
  }

  return (
    <Box flexDirection="column">
      <StepIndicator current={3} total={3} label="First review" />

      <Box flexDirection="column" gap={1}>
        {phase === 'checking' && (
          <StatusLine state="loading" label="Looking for staged files..." />
        )}

        {(phase === 'confirm' || phase === 'running' || phase === 'done') && (
          <Box flexDirection="column">
            <Text color="gray">{stagedFiles.length} staged file(s):</Text>
            {stagedFiles.map(f => (
              <Box key={f} gap={1}>
                <Text color="gray">  ├─</Text>
                <Text>{f}</Text>
              </Box>
            ))}
          </Box>
        )}

        {phase === 'confirm' && (
          <Box flexDirection="column">
            <Text color="gray">Run a review now?</Text>
            <SelectInput items={CONFIRM} onSelect={handleConfirm} />
          </Box>
        )}

        {phase === 'running' && (
          <StatusLine state="loading" label="Reviewing with Guardian..." />
        )}

        {phase === 'done' && runStatus && (
          <StatusLine
            state={runStatus === 'passed' ? 'success' : 'error'}
            label={runStatus === 'passed' ? 'STATUS: PASSED' : 'STATUS: FAILED'}
          />
        )}
      </Box>
    </Box>
  );
}
