#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${PLUGIN_ROOT:-}" ]]; then
  PROJECT_ROOT="$PLUGIN_ROOT"
else
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

node "$PROJECT_ROOT/scripts/frontend-architecture.mjs" "$@"
