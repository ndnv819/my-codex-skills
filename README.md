# My Codex Skills

Local Codex plugin marketplace for the plugins in this repository.

## Installation

From the repository root, add the marketplace:

```bash
codex plugin marketplace add .
```

Then restart Codex, open `/plugins`, and enable the plugins you want from **My Codex Skills**.

## Available Plugins

| Plugin | Exposed skill | Use for |
| --- | --- | --- |
| [nextjs-app-router-performance](./plugins/nextjs-app-router-performance/) | `nextjs-initial-load-audit`, `nextjs-server-data-flow` | App Router initial-load checks, server/client boundary review, provider placement, server-first data flow, and safe code splitting. |
| [react-performance](./plugins/react-performance/) | `react-render-optimization` | React render profiling, unnecessary re-render reduction, memoization review, and list optimization. |
| [typescript-vitest](./plugins/typescript-vitest/) | `vitest-test-authoring` | Focused Vitest test authoring and verification for TypeScript behavior changes and refactors. |
| [storybook-auto-composer](./plugins/storybook-auto-composer/) | `storybook-auto-composer` | Storybook bring-up for React and Next.js projects, including setup, mocks, story generation, interactions, visual baselines, and validation. |
| [git-workflow](./plugins/git-workflow/) | `git-workflow` | Branch naming, commit and PR conventions, issue key handling, SemVer recommendations, release tags, and changelog guidance. |
| [frontend-architecture](./plugins/frontend-architecture/) | `react-layered-architecture` | React project structure scaffolding and audits for Next.js App Router and Expo Router using presentation, application, infrastructure, and env boundaries. |

## Structure

The repository only needs to expose the marketplace index, plugin manifests, and skill folders. Plugin-specific scripts or references stay inside the owning plugin.

```text
.agents/plugins/marketplace.json
plugins/
  <plugin-name>/
    .codex-plugin/plugin.json
    README.md
    scripts/  # optional
    skills/<skill-name>/references/  # optional
    skills/<skill-name>/SKILL.md
scripts/validate-plugins.sh
```

Each plugin is registered with a `.codex-plugin/plugin.json` manifest and the repo-level marketplace index.

## Validation

```bash
./scripts/validate-plugins.sh
```

The validation script checks that the marketplace entries point to existing plugin directories and that every plugin has a valid Codex manifest.
