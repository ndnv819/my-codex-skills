# AGENTS.md

This repository contains a local Codex plugin marketplace and the plugin sources registered in that marketplace.

## Documentation Language Policy

All agent-facing documentation (`AGENTS.md`, `SKILL.md`, plugin docs, command docs) should be written in English, with exceptions for Korean proper nouns or technical terms where translation would reduce accuracy.

## Repository Layout

Keep the root focused on the marketplace index, plugin source directories, and repository-level validation scripts.

```text
my-codex-skills/
├── .agents/plugins/marketplace.json
├── plugins/
│   ├── nextjs-app-router-performance/
│   │   ├── .codex-plugin/plugin.json
│   │   ├── README.md
│   │   ├── scripts/nextjs-app-router-performance.sh
│   │   └── skills/
│   │       ├── nextjs-initial-load-audit/SKILL.md
│   │       └── nextjs-server-data-flow/SKILL.md
│   └── ...
└── scripts/validate-plugins.sh
```

## Plugin Rules

Every plugin must include:

- `plugins/<plugin-name>/.codex-plugin/plugin.json`
- A matching `name` field in the manifest
- A marketplace entry in `.agents/plugins/marketplace.json`
- A `source.path` that starts with `./plugins/`

Only `plugin.json` belongs in `.codex-plugin/`. Keep `skills/`, `hooks/`, `scripts/`, `.mcp.json`, `.app.json`, and assets at the plugin root.

Skill instructions should live under `plugins/<plugin-name>/skills/<skill-name>/SKILL.md`. Optional references for a skill should stay under that skill directory, for example `skills/<skill-name>/references/`.

## Path Resolution

Plugins are installed into a Codex plugin cache, so the plugin root is different from the user's working directory. Prefer scripts that resolve paths from the plugin root.

Codex exposes `PLUGIN_ROOT` for lifecycle hooks. New scripts should prefer `PLUGIN_ROOT` and fall back to paths relative to the script location for standalone execution.

Recommended shell pattern:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${PLUGIN_ROOT:-}" ]]; then
  PROJECT_ROOT="$PLUGIN_ROOT"
else
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi
```

## Validation

Run this before publishing changes:

```bash
./scripts/validate-plugins.sh
```

For plugin behavior changes, also test the specific plugin from a separate repository after installing it through the local marketplace.
