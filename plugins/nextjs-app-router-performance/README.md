# Next.js App Router Performance

Next.js App Router performance assistant for fast initial loading, server-first data flow, explicit caching, and safe code splitting.

## Overview

- Runs a production build through the project's existing build script.
- Checks whether the project uses the App Router.
- Flags route-level `use client` boundaries that should usually be pushed down to leaf components.
- Flags root layout provider placement that may force all routes into a heavier initial graph.
- Flags heavy client-side libraries such as editors, charts, maps, markdown renderers, PDF viewers, spreadsheets, and 3D libraries.
- Keeps ordinary page and layout data reads in Server Components.
- Uses Server Actions for app-owned mutations and keeps cache/revalidation behavior explicit.
- Reports legacy `Size` and `First Load JS` metrics only when the installed Next.js version still prints them.
- Enforces JavaScript budgets only when the project explicitly defines them.

## Included Skills

| Skill | Purpose |
| --- | --- |
| `nextjs-initial-load-audit` | Check App Router initial-load risks, review server/client boundaries, inspect provider placement, and guide safe code splitting. |
| `nextjs-server-data-flow` | Keep Next.js reads server-first, mutations in Server Actions, Client Components narrow, and React Query usage limited to justified client-side cases. |

## Usage

Use this plugin when working on App Router routes, layouts, Client Components, provider placement, heavy UI libraries, dynamic imports, bundle analysis, data fetching, Server Actions, cache policy, or frontend changes that may affect initial load.

## Scripts

```bash
${PLUGIN_ROOT}/scripts/nextjs-app-router-performance.sh
```

Useful flags:

```bash
${PLUGIN_ROOT}/scripts/nextjs-app-router-performance.sh --project /path/to/next-app
${PLUGIN_ROOT}/scripts/nextjs-app-router-performance.sh --no-build
${PLUGIN_ROOT}/scripts/nextjs-app-router-performance.sh --json
```

## Configuration

Optional project config:

Use `.codex/nextjs-app-router-performance.json` or `nextjs-app-router-performance.json` only when the project has its own agreed JavaScript budgets. Supported fields are `firstLoadJsKb`, `routeJsKb`, `sharedFirstLoadJsKb`, `failOnBudgetExceeded`, and per-route overrides under `routes`.

## Notes

This plugin does not define a page-level recommended kB size. App Router performance work should focus on keeping the initial client graph small, preserving Server Components, keeping ordinary app data server-first, and using the official analyzer when bundle composition needs inspection.

Without project-defined budgets, the script reports measured sizes and initial-load risks without failing on arbitrary kB thresholds.

This plugin is registered in this repository's `.agents/plugins/marketplace.json`.
