---
name: guardian-install
description: >
  Guides you through installing and setting up Guardian — the AI-powered Git hook for automated code review — in any project.
  Use this skill whenever the user wants to add Guardian to a project, set up AI code review as a pre-commit hook, run `guardian init` or `guardian install`, create the `.guardian` config or `AGENTS.md` rules file, or protect a repo with AI-assisted commit gating.
  Trigger even if the user just asks "how do I use Guardian?" or "can you set up Guardian for me?"
---

# Guardian — Installation & Setup

Guardian runs AI-assisted code review as a Git hook. When you commit, it inspects staged files, applies your project rules from `AGENTS.md`, calls the configured AI provider, and blocks the commit if the review fails.

## Prerequisites

- Node.js ≥ 22
- An AI provider CLI already installed and authenticated (`claude`, `gemini`, `opencode`, `codex`, or `agy-agent`)
- A Git repository

## Step 1 — Install Guardian

**From npm (recommended):**

```bash
npm install -D @ajosecortes/guardian-cli
```

**Globally:**

```bash
npm install -g @ajosecortes/guardian-cli
```

Verify:

```bash
npx guardian --help
```

## Step 2 — Initialize the project

Inside the Git repo you want to protect:

```bash
guardian init
```

This creates two files:

| File        | Purpose                                               |
| ----------- | ----------------------------------------------------- |
| `.guardian` | Project configuration (provider, file patterns, etc.) |
| `AGENTS.md` | Review rules the AI will follow                       |

## Step 3 — Install the Git hook

```bash
guardian install
```

This injects a hook block into `.git/hooks/pre-commit` that runs:

```bash
npx guardian run || exit 1
```

To hook `commit-msg` instead of `pre-commit`:

```bash
guardian install --commit-msg
```

## Step 4 — Configure `.guardian`

Edit the generated `.guardian` file to match your project:

```ini
PROVIDER="claude"
FILE_PATTERNS="*.ts,*.tsx,*.js,*.jsx"
EXCLUDE_PATTERNS="*.test.ts,*.spec.ts,*.d.ts,*.stories.tsx"
RULES_FILE="AGENTS.md"
STRICT_MODE="true"
CACHE="true"
```

**Minimal setup** — only `PROVIDER` is required. Everything else has sensible defaults.

### Choosing a provider

```ini
PROVIDER="claude"       # Claude Code CLI
PROVIDER="gemini"       # Gemini CLI
PROVIDER="opencode"     # OpenCode CLI (default model)
PROVIDER="opencode:anthropic/claude-opus-4"  # OpenCode with specific model
PROVIDER="codex"        # OpenAI Codex CLI
PROVIDER="codex:o3"     # Codex with specific model
PROVIDER="antigravity"  # Antigravity CLI (agy-agent)
PROVIDER="antigravity:my-model"  # Antigravity with specific model
```

The provider CLI must be installed and in `PATH`.

## Step 5 — Write your `AGENTS.md`

This is where the AI gets its review instructions. Be explicit about what matters in your project:

```markdown
# Code Review Rules

## General

- Enforce consistent naming conventions
- Flag functions longer than 50 lines
- Reject console.log left in production code

## TypeScript

- Require explicit return types on public functions
- No use of `any` type

## Security

- Flag hardcoded credentials or tokens
- Validate all user inputs at system boundaries
```

You can also reference other markdown files using backtick syntax:

```markdown
- UI rules: `docs/ui-rules.md`
- API rules: `docs/api-rules.md`
```

Guardian will inline those files into the final prompt automatically.

## Step 6 — Install Guardian skills (optional)

Install Guardian's skill set into your AI provider so it understands the tool natively:

```bash
guardian add skills
```

## Verify it works

```bash
guardian run
```

This runs a manual review against currently staged files. You should see the AI provider output and a final `STATUS: PASSED` or `STATUS: FAILED`.

## Ignoring files

Create a `.guardianignore` file in the project root to exclude paths from review (same syntax as `.gitignore`):

```
dist/
*.generated.ts
coverage/
```

## Removing Guardian

```bash
guardian uninstall
```

Removes Guardian's hook block from `pre-commit` and `commit-msg`. Does not delete `.guardian` or `AGENTS.md`.

## Troubleshooting

| Problem              | Fix                                                               |
| -------------------- | ----------------------------------------------------------------- |
| "Provider not found" | Install the provider CLI and make sure it's in `PATH`             |
| Hook not running     | Check `.git/hooks/pre-commit` is executable (`chmod +x`)          |
| Review always passes | Check `STRICT_MODE="true"` and verify `AGENTS.md` has clear rules |
| Slow on large repos  | Enable `CACHE="true"` — unchanged files are skipped automatically |
