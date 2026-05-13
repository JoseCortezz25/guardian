import React from 'react';
import { Box, Text } from 'ink';
import { version } from '../../../package.json';

export function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="cyan" bold>
          ◆ Guardian
        </Text>
        <Text color="gray"> v{version}</Text>
      </Box>
      <Text color="gray">{'─'.repeat(44)}</Text>
    </Box>
  );
}
