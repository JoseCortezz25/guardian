import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { StepIndicator } from '../shared/StepIndicator';
import { StatusLine } from '../shared/StatusLine';
import { initCommand } from '../../commands/init';
import { installCommand } from '../../commands/install';
import type { ConfigResult } from './StepConfig';

const HOOKS = [
  { label: 'pre-commit  (antes de hacer commit)', value: 'pre-commit' },
  { label: 'commit-msg  (valida el mensaje)', value: 'commit-msg' },
];

export interface InstallResult {
  hook: string;
}

interface StepInstallProps {
  config: ConfigResult;
  onComplete: (result: InstallResult) => void;
}

type Phase = 'init' | 'select' | 'installing';

export function StepInstall({ config, onComplete }: StepInstallProps) {
  const [phase, setPhase] = useState<Phase>('init');
  const [initStatus, setInitStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    void (async () => {
      const code = await initCommand(config.rulesFile, config.provider);
      setInitStatus(code === 0 ? 'success' : 'error');
      if (code === 0) setPhase('select');
    })();
  }, []);

  async function handleHookSelect(item: { value: string }) {
    setPhase('installing');
    const commitMsg = item.value === 'commit-msg';
    await installCommand({ commitMsg });
    onComplete({ hook: item.value });
  }

  return (
    <Box flexDirection="column">
      <StepIndicator current={2} total={3} label="Instalación" />

      <Box flexDirection="column" gap={1}>
        <StatusLine
          state={initStatus}
          label={
            initStatus === 'loading'
              ? `Creando ${config.rulesFile} y .guardian...`
              : `${config.rulesFile} y .guardian creados`
          }
        />

        {phase === 'select' && (
          <Box flexDirection="column">
            <Text color="gray">¿En qué hook quieres instalarlo?</Text>
            <SelectInput items={HOOKS} onSelect={handleHookSelect} />
          </Box>
        )}

        {phase === 'installing' && (
          <StatusLine state="loading" label="Instalando hook..." />
        )}
      </Box>
    </Box>
  );
}
