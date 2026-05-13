import React from 'react';
import { render } from 'ink';
import { Setup } from '../ui/setup/Setup';

export async function setupCommand(): Promise<number> {
  const { waitUntilExit } = render(React.createElement(Setup));
  await waitUntilExit();
  return 0;
}
