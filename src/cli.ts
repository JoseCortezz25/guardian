#!/usr/bin/env node
import { Command } from 'commander';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('gga-ts')
    .description('Guardian CLI (TypeScript)')
    .version('1.0.0')
    .option('-v, --verbose', 'Enable verbose output', false);

  // TODO(batch-2): wire real commands from src/commands.
  program
    .command('placeholder')
    .description('Placeholder command until command modules are implemented')
    .action(() => {
      process.stdout.write('TODO: implement command modules in the next batch.\n');
    });

  return program;
}

async function main(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}

void main();
