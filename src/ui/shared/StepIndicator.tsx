import React from 'react';
import { Box, Text } from 'ink';

interface StepIndicatorProps {
  current: number;
  total: number;
  label: string;
}

export function StepIndicator({ current, total, label }: StepIndicatorProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text color="gray">
          Step {current} of {total}
        </Text>
        <Text color="gray">—</Text>
        <Text color="cyan" bold>
          {label}
        </Text>
      </Box>
      <Text color="gray">{'─'.repeat(44)}</Text>
    </Box>
  );
}
