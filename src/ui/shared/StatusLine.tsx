import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface StatusLineProps {
  state: 'loading' | 'success' | 'error';
  label: string;
}

export function StatusLine({ state, label }: StatusLineProps) {
  return (
    <Box gap={1}>
      {state === 'loading' && (
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
      )}
      {state === 'success' && <Text color="green">✔</Text>}
      {state === 'error' && <Text color="red">✖</Text>}
      <Text>{label}</Text>
    </Box>
  );
}
