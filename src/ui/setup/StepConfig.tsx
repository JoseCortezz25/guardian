import React, { useState } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { StepIndicator } from '../shared/StepIndicator';

const PROVIDERS = [
  { label: 'Claude', value: 'claude' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenCode', value: 'opencode' },
  { label: 'Codex', value: 'codex' },
  { label: 'Antigravity', value: 'antigravity' },
];

export interface ConfigResult {
  rulesFile: string;
  provider: string;
}

interface StepConfigProps {
  isReconfigure: boolean;
  onComplete: (result: ConfigResult) => void;
}

type Phase = 'rulesFile' | 'provider';

export function StepConfig({ isReconfigure, onComplete }: StepConfigProps) {
  const [phase, setPhase] = useState<Phase>('rulesFile');
  const [rulesFile, setRulesFile] = useState('AGENTS.md');

  useInput((_: string, key: Key) => {
    if (phase === 'rulesFile' && key.return) {
      setPhase('provider');
    }
  });

  function handleProviderSelect(item: { value: string }) {
    onComplete({ rulesFile: rulesFile || 'AGENTS.md', provider: item.value });
  }

  return (
    <Box flexDirection="column">
      <StepIndicator
        current={1}
        total={3}
        label={isReconfigure ? 'Reconfigure' : 'Configuration'}
      />

      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text color="gray">Rules file name?</Text>
          <Box gap={1}>
            <Text color="cyan">›</Text>
            <TextInput
              value={rulesFile}
              onChange={setRulesFile}
              placeholder="AGENTS.md"
              focus={phase === 'rulesFile'}
            />
          </Box>
        </Box>

        {phase === 'provider' && (
          <Box flexDirection="column">
            <Text color="gray">Which AI provider do you use?</Text>
            <SelectInput items={PROVIDERS} onSelect={handleProviderSelect} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
