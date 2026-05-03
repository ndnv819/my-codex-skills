# TypeScript Vitest

TypeScript and Vitest assistant plugin for focused test authoring, coverage-gap checks, and verification after behavior-affecting code changes.

## Overview

- Uses Vitest as the only supported test framework.
- Applies to TypeScript production-code changes that affect behavior or must preserve behavior.
- Checks existing Vitest tests before adding new ones.
- Adds focused tests only when there is a meaningful coverage gap.
- Runs the narrowest useful Vitest command first, then broader validation when appropriate.
- Avoids automatic migration from Jest, Playwright, Cypress, or other non-Vitest test stacks.

## Included Skills

| Skill | Purpose |
| --- | --- |
| `vitest-test-authoring` | Decide when TypeScript behavior changes need Vitest coverage, write focused tests, and verify them. |

## Usage

Use this plugin when working on TypeScript functions, utilities, hooks, services, reducers, parsers, validators, async flows, error handling, bug fixes, or refactors where behavior must stay stable.

The skill is designed to trigger even when the user does not explicitly ask for tests, but only when TypeScript production behavior or regression risk is involved.

## Scripts

Inspect a target project:

```bash
${PLUGIN_ROOT}/scripts/typescript-vitest.sh --project /path/to/project
```

Return machine-readable project detection output:

```bash
${PLUGIN_ROOT}/scripts/typescript-vitest.sh --project /path/to/project --json
```

## Notes

If Vitest is missing and the project has no conflicting test framework, the skill may add Vitest as a development dependency before writing tests.

If a non-Vitest test stack already owns the project, the skill should not migrate it silently. It should report the conflict and ask for explicit direction before changing test frameworks.

This plugin is registered in this repository's `.agents/plugins/marketplace.json`.
