import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { Header } from '../shared/Header';
import { StepConfig, type ConfigResult } from './StepConfig';
import { StepInstall, type InstallResult } from './StepInstall';
import { StepRun } from './StepRun';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

const RECONFIGURE = [
  { label: 'Sí, reconfigurar', value: 'yes' },
  { label: 'No, salir', value: 'no' },
];

type Step = 'detecting' | 'reconfigure' | 'config' | 'install' | 'run' | 'done';

export function Setup() {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('detecting');
  const [isReconfigure, setIsReconfigure] = useState(false);
  const [config, setConfig] = useState<ConfigResult | null>(null);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await access(join(process.cwd(), '.guardian'));
        setIsReconfigure(true);
        setStep('reconfigure');
      } catch {
        setStep('config');
      }
    })();
  }, []);

  function handleReconfigure(item: { value: string }) {
    if (item.value === 'no') {
      exit();
    } else {
      setStep('config');
    }
  }

  function handleConfigComplete(result: ConfigResult) {
    setConfig(result);
    setStep('install');
  }

  function handleInstallComplete(result: InstallResult) {
    setInstallResult(result);
    setStep('run');
  }

  function handleRunComplete() {
    setStep('done');
    exit();
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      {step === 'detecting' && <Text color="gray">Detectando estado del proyecto...</Text>}

      {step === 'reconfigure' && (
        <Box flexDirection="column" gap={1}>
          <Text>
            <Text color="yellow">⚠</Text>
            <Text> Guardian ya está configurado en este proyecto.</Text>
          </Text>
          <Text color="gray">¿Quieres reconfigurarlo?</Text>
          <SelectInput items={RECONFIGURE} onSelect={handleReconfigure} />
        </Box>
      )}

      {step === 'config' && (
        <StepConfig isReconfigure={isReconfigure} onComplete={handleConfigComplete} />
      )}

      {step === 'install' && config && (
        <StepInstall config={config} onComplete={handleInstallComplete} />
      )}

      {step === 'run' && <StepRun onComplete={handleRunComplete} />}

      {step === 'done' && (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text color="gray">{'─'.repeat(44)}</Text>
          <Text>
            <Text color="green">✔</Text>
            <Text> Guardian listo. El hook correrá en cada commit.</Text>
          </Text>
          {installResult && (
            <Text color="gray">Hook instalado en .husky/{installResult.hook}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
