# Guardian

Guardian is a TypeScript CLI that runs AI-assisted code review as a Git hook.

It inspects staged files, builds a review prompt from your project rules, calls a configured provider CLI, and blocks the commit if the review fails.

## Features

- Git hook integration for pre-commit workflows
- Configurable provider support:
  - Claude
  - Gemini
  - OpenCode
- Project-level and global configuration
- Rule loading from `AGENTS.md`
- Support for referenced markdown rule files
- Content-based cache to skip unchanged files
- CLI commands for init, install, run, and cache management

## Installation

### Local development

```bash
npm install
npm run build
```

Run the CLI directly:

```bash
node dist/cli.js --help
```

Available scripts:

| Script                 | Description               |
| ---------------------- | ------------------------- |
| `npm run build`        | Compile TypeScript        |
| `npm test`             | Run tests                 |
| `npm run test:watch`   | Run tests in watch mode   |
| `npm run lint`         | Run ESLint                |
| `npm run lint:fix`     | Run ESLint with autofix   |
| `npm run format`       | Format with Prettier      |
| `npm run format:check` | Check Prettier formatting |

### Link globally

```bash
npm link
guardian --help
```

### Install in another repo

Using a local pack:

```bash
npm pack
```

Then in another repository:

```bash
npm install -D /path/to/guardian-1.0.0.tgz
npx guardian --help
```

## Quick start

Inside a Git repository you want to protect:

```bash
guardian init
guardian install
```

This creates:

- `.guardian` — project config
- `AGENTS.md` — review rules for the AI

Then update both files for your project.

## Configuration

Guardian loads config in this order:

1. environment variables
2. project `.guardian`
3. global `~/.config/guardian/config`
4. built-in defaults

### Example `.guardian`

```ini
PROVIDER="claude"
FILE_PATTERNS="*.ts,*.tsx,*.js,*.jsx"
EXCLUDE_PATTERNS="*.test.ts,*.spec.ts,*.d.ts,*.stories.tsx"
RULES_FILE="AGENTS.md"
STRICT_MODE="true"
TIMEOUT="300"
CACHE="true"
```

### Supported keys

- `PROVIDER`
- `FILE_PATTERNS`
- `EXCLUDE_PATTERNS`
- `RULES_FILE`
- `STRICT_MODE`
- `TIMEOUT`
- `PR_BASE_BRANCH`
- `CACHE`

### Provider values

Examples:

```ini
PROVIDER="claude"
PROVIDER="gemini"
PROVIDER="opencode"
PROVIDER="opencode:anthropic/claude-opus-4"
```

### Environment variables

- `GUARDIAN_PROVIDER`
- `GUARDIAN_TIMEOUT`
- `GUARDIAN_STRICT_MODE`
- `GUARDIAN_RULES_FILE`
- `GUARDIAN_CACHE`

## Rules file

Guardian reads your rules from `AGENTS.md` by default.

It also expands backticked markdown references, for example:

```md
- UI rules: `docs/ui-rules.md`
- API rules: `docs/api-rules.md`
```

If those files exist, their contents are appended to the final prompt.

## Commands

### `guardian init`

Creates default `.guardian` and `AGENTS.md` files.

### `guardian install`

Installs the Git hook into `.git/hooks/pre-commit`.

```bash
guardian install
```

Install into `commit-msg` instead:

```bash
guardian install --commit-msg
```

### `guardian uninstall`

Removes Guardian-installed hook blocks from `pre-commit` and `commit-msg`.

### `guardian run`

Runs the review manually.

```bash
guardian run
```

Options:

- `--no-cache`
- `--pr-mode`
- `--ci`

### `guardian cache status`

Shows cache status for the current project.

### `guardian cache clear`

Clears the current project cache.

### `guardian cache clear-all`

Clears all Guardian cache data.

## Hook behavior

After installation, Guardian adds a hook block that runs:

```bash
npx guardian run || exit 1
```

If the provider returns:

- `STATUS: PASSED` → the commit continues
- `STATUS: FAILED` → the commit is blocked
- ambiguous output → behavior depends on `STRICT_MODE`

## Cache behavior

Guardian stores cache data under:

```bash
~/.cache/guardian
```

The cache is keyed by file content hash and invalidates automatically when:

- your rules file changes
- your project `.guardian` changes

## Provider requirements

Guardian shells out to installed provider CLIs. The selected provider must already be installed and available in `PATH`.

Examples:

- `claude`
- `gemini`
- `opencode`
