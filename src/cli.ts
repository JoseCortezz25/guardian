#!/usr/bin/env node
import { Command } from 'commander';
import { cacheClearAllCommand, cacheClearCommand, cacheStatusCommand } from './commands/cache';
import { initCommand } from './commands/init';
import { installCommand, uninstallCommand } from './commands/install';
import { runCommand } from './commands/run';
import { setupCommand } from './commands/setup';
import { updateCommand } from './commands/update';
import { version } from '../package.json';

async function exitWith(command: Promise<number>): Promise<never> {
  process.exit(await command);
}

export function createProgram(): Command {
  const program = new Command();

  program.name('guardian').description('Guardian CLI').version(version, '-v, -V, --version');

  program
    .command('setup')
    .description('Interactive guided setup (init + install + run)')
    .action(async () => exitWith(setupCommand()));

  program
    .command('init')
    .description('Create default .guardian and AGENTS.md files')
    .action(async () => exitWith(initCommand()));

  program
    .command('install')
    .description('Install the git hook')
    .option('--commit-msg', 'Install into commit-msg instead of pre-commit')
    .action(async (opts: { commitMsg?: boolean }) => exitWith(installCommand(opts)));

  program
    .command('uninstall')
    .description('Remove installed Guardian hook blocks')
    .action(async () => exitWith(uninstallCommand()));

  program
    .command('run')
    .description('Run the guardian review')
    .option('--no-cache', 'Disable cache for this run')
    .option('--pr-mode', 'Review files changed against the base branch')
    .option('--ci', 'Review files changed in the last commit')
    .option('--all', 'Review all tracked files in the repository')
    .option(
      '--files <patterns...>',
      'Filter reviewed files by glob patterns (use with --all or --ci)'
    )
    .option('--report', 'Generate a markdown report in guardian/reports/')
    .action(
      async (opts: {
        noCache?: boolean;
        prMode?: boolean;
        ci?: boolean;
        all?: boolean;
        files?: string[];
        report?: boolean;
      }) => exitWith(runCommand(opts))
    );

  const cache = program.command('cache').description('Inspect and manage cache');

  cache
    .command('status')
    .description('Show project cache status')
    .action(async () => exitWith(cacheStatusCommand()));

  cache
    .command('clear')
    .description('Clear the current project cache')
    .action(async () => exitWith(cacheClearCommand()));

  cache
    .command('clear-all')
    .description('Clear all Guardian cache data')
    .action(async () => exitWith(cacheClearAllCommand()));

  program
    .command('update')
    .description('Update Guardian CLI to the latest version')
    .action(async () => exitWith(updateCommand()));

  return program;
}

async function main(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}

void main();
