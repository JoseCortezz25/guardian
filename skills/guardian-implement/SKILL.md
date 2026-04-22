---
name: guardian-implement
description: >
  Deep-dive guide for configuring and using Guardian's advanced features in an existing project.
  Use this skill whenever the user wants to tune Guardian's behavior beyond basic setup: configuring providers with model selection, adjusting file patterns, setting up STRICT_MODE, using different run modes (--pr-mode, --ci, --all), structuring AGENTS.md with file references, managing the cache, or integrating Guardian into CI pipelines.
  Trigger when the user asks about Guardian configuration, run modes, AGENTS.md structure, cache behavior, or provider setup in depth — even if they don't say "implement".
---

# Guardian — Advanced Configuration & Implementation

This skill assumes Guardian is already installed. If not, use the `guardian-install` skill first.

## Configuration loading order

Guardian merges config from these sources, highest priority first:

1. Environment variables (`GUARDIAN_*`)
2. Project `.guardian` file
3. Global `~/.config/guardian/config`
4. Built-in defaults

This means you can override per-environment without touching the committed config.

## Full `.guardian` reference

```ini
# AI provider to use
PROVIDER="claude"

# Glob patterns for files to review (comma-separated)
FILE_PATTERNS="*.ts,*.tsx,*.js,*.jsx,*.vue,*.py"

# Glob patterns to exclude from review (comma-separated)
EXCLUDE_PATTERNS="*.test.ts,*.spec.ts,*.d.ts,*.stories.tsx,dist/**"

# Path to the rules file (default: AGENTS.md)
RULES_FILE="AGENTS.md"

# Block commit on ambiguous/inconclusive output (default: false)
STRICT_MODE="true"

# Max seconds to wait for provider response
TIMEOUT="300"

# Enable content-based cache to skip unchanged files
CACHE="true"

# Base branch for --pr-mode diff (default: main)
PR_BASE_BRANCH="main"
```

### Environment variable overrides

| Variable | Overrides |
|----------|-----------|
| `GUARDIAN_PROVIDER` | `PROVIDER` |
| `GUARDIAN_TIMEOUT` | `TIMEOUT` |
| `GUARDIAN_STRICT_MODE` | `STRICT_MODE` |
| `GUARDIAN_RULES_FILE` | `RULES_FILE` |
| `GUARDIAN_CACHE` | `CACHE` |

Useful for CI where you don't want to commit credentials or environment-specific settings.

## Provider configuration

Guardian shells out to the provider CLI — that CLI must be installed and in `PATH`.

```ini
# Claude Code CLI
PROVIDER="claude"

# Google Gemini CLI
PROVIDER="gemini"

# OpenCode with its default model
PROVIDER="opencode"

# OpenCode with a specific model
PROVIDER="opencode:anthropic/claude-opus-4"
PROVIDER="opencode:google/gemini-2.5-pro"
```

## AGENTS.md — structuring your rules

### Flat rules (simple projects)

```markdown
# Review Rules

- No console.log in production files
- Require explicit TypeScript return types
- Flag hardcoded secrets or API keys
- Max function length: 50 lines
```

### Modular rules with file references

Use backtick references to split rules across files. Guardian inlines them automatically:

```markdown
# Review Rules

## Standards
- `docs/review/typescript-rules.md`
- `docs/review/security-rules.md`
- `docs/review/naming-conventions.md`

## Architecture
- `docs/review/clean-architecture.md`
```

Each referenced file's content is appended to the prompt. This keeps `AGENTS.md` clean while allowing detailed rule documents per domain.

### Writing effective rules

Rules work best when they are:
- **Specific**: "Flag functions over 50 lines" beats "keep functions short"
- **Actionable**: the AI should know exactly what to flag vs. approve
- **Scoped**: separate concerns (security, style, architecture) into sections

```markdown
## Security
- Reject any hardcoded token, password, or secret (use env vars)
- Flag SQL queries built by string concatenation
- Require input validation for all data entering the system boundary

## TypeScript
- No `any` type — use `unknown` + type guards instead
- Public API functions must have explicit return type annotations
- Enums over raw string literals for domain values

## Architecture
- `docs/review/hexagonal-arch.md`
- No direct database calls from UI components
- Services must not import from other services (use interfaces)
```

## Run modes

Guardian supports four mutually exclusive modes:

| Mode | Command | Files reviewed |
|------|---------|----------------|
| Staged *(default)* | `guardian run` | Staged files (`git diff --cached`) |
| PR | `guardian run --pr-mode` | Files changed vs. base branch |
| CI | `guardian run --ci` | Files changed in last commit |
| All | `guardian run --all` | All tracked files in the repo |

### When to use each mode

- **Staged** — default for the pre-commit hook. Fastest, only reviews what you're about to commit.
- **PR** — useful in pre-push hooks or local PR validation before opening a PR.
- **CI** — designed for CI pipelines; reviews the diff introduced by the last commit.
- **All** — one-off full audits. Cache still applies, so unchanged files are skipped.

```bash
# Skip cache for a clean run
guardian run --no-cache

# Full audit ignoring cache
guardian run --all --no-cache
```

## Cache behavior

Guardian caches reviews by **file content hash** under `~/.cache/guardian`.

The cache invalidates automatically when:
- `AGENTS.md` (or your `RULES_FILE`) changes
- `.guardian` changes

File reads are parallelized, so cache lookups and content loading happen concurrently — this makes large staged sets fast.

### Cache commands

```bash
# Show cache status for the current project
guardian cache status

# Clear cache for the current project only
guardian cache clear

# Clear all Guardian cache data across all projects
guardian cache clear-all
```

## CI/CD integration

Example GitHub Actions step:

```yaml
- name: Guardian code review
  run: npx guardian run --ci
  env:
    GUARDIAN_PROVIDER: claude
    GUARDIAN_STRICT_MODE: "true"
```

Set `STRICT_MODE="true"` in CI so ambiguous output fails the pipeline rather than silently passing.

## Hook behavior

After `guardian install`, the hook block added to `.git/hooks/pre-commit` runs:

```bash
npx guardian run || exit 1
```

Guardian exits with:
- `0` (pass) → commit continues if review output contains `STATUS: PASSED`
- `1` (fail) → commit is blocked if output contains `STATUS: FAILED`
- Ambiguous output → depends on `STRICT_MODE`:
  - `STRICT_MODE="false"` (default) → passes through
  - `STRICT_MODE="true"` → blocks the commit

## Uninstalling

```bash
guardian uninstall
```

Removes only the Guardian-managed hook block. Leaves any pre-existing hook content intact.
