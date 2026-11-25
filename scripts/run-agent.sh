#!/usr/bin/env bash
# Runs unit-test-agent headless with the same restrictions locally and in CI.
# Usage: scripts/run-agent.sh "<prompt>"   (MAX_TURNS overrides the turn limit)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Tests written by the agent run through vitest, so any code they contain can
# read the environment. Strip the model token from every subprocess.
export CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1

# Bash rules match each part of a compound command separately,
# so `cd frontend && npx vitest run x` needs both `cd` and `npx` rules.
exec claude -p --agent unit-test-agent \
  --permission-mode dontAsk \
  --allowedTools Read Grep Glob Edit Write Skill \
    "Bash(cd backend)" "Bash(cd frontend)" \
    "Bash(npx vitest run *)" "Bash(npx tsc --noEmit)" \
  --disallowedTools "Read(./.env)" \
  --max-turns "${MAX_TURNS:-40}" \
  --output-format json \
  "$1"
