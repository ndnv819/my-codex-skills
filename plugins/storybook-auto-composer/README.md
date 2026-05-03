# Storybook Auto Composer

Storybook bring-up assistant for making React and Next.js projects usable in Storybook, not merely generating story files.

## Overview

- Installs and bootstraps Storybook when the target project does not have it.
- Configures React and Next.js App Router projects with the appropriate Storybook framework.
- Wires Next.js App Router runtime support, including navigation parameters and `next/image` or `next/font` considerations.
- Detects existing MSW handlers and connects them to Storybook, or scaffolds minimal handlers when API-dependent components need mocks.
- Generates and improves `.stories.tsx` files after Storybook configuration and mock foundations are in place.
- Adds meaningful `play` functions using the project's Storybook test API style.
- Creates local screenshot baselines for visual regression checks when a running Storybook instance is available.
- Validates the result with Storybook build, relevant tests, browser checks, and fix loops.

## Included Skills

| Skill | Purpose |
| --- | --- |
| `storybook-auto-composer` | Bring a React or Next.js project to a working Storybook state: install, configure, mock, compose stories, add interactions, create visual baselines, and validate. |

## Scripts

### Inventory

```bash
${PLUGIN_ROOT}/scripts/storybook-inventory.sh --project <project-root> --json
```

Reports package manager, Storybook setup, React/Next.js signals, App Router usage, MSW signals, story files, component candidates, likely missing stories, and recommended commands.

### Screenshot Baselines

```bash
${PLUGIN_ROOT}/scripts/storybook-screenshots.sh \
  --project <project-root> \
  --url http://127.0.0.1:6006 \
  --out .storybook/visual-baselines
```

Fetches Storybook's story index from a running Storybook server and captures story iframe screenshots with Playwright. The target project must already have Playwright available, or Codex should install it as a dev dependency when visual baselines are in scope.

## Usage

Use this plugin when asked to:

- Make Storybook actually usable in a project.
- Add Storybook from scratch to a React or Next.js project.
- Generate stories for existing components.
- Fix Storybook failures caused by Next.js App Router APIs, providers, fonts, images, routing, or API calls.
- Add interaction stories or visual screenshot baselines.

## Notes

The plugin prioritizes a runnable Storybook environment over raw story count. Story files are generated after framework setup, runtime mocks, providers, and API mock strategy are understood so the generated stories are executable.

This plugin is registered in this repository's `.agents/plugins/marketplace.json`.
