---
name: vitest-test-authoring
description: Write and verify focused Vitest tests for TypeScript projects. Use when making, reviewing, or validating TypeScript production-code changes that affect behavior or must preserve behavior, including exported functions, utilities, hooks, services, reducers, parsers, validators, async flows, error handling, bug fixes, and refactors. Automatically consider whether Vitest coverage is needed even when the user does not explicitly ask for tests. Avoid for docs-only, style-only, config-only, type-only, or test-only changes unless the user explicitly asks for test work.
---

# Vitest Test Authoring

## Purpose

Use this skill to decide whether a TypeScript change needs Vitest coverage, add focused tests when there is a real coverage gap, and verify the result with the narrowest useful commands.

## Use When

- Making, reviewing, or validating TypeScript production-code changes that affect behavior or must preserve behavior.
- Covering exported functions, utilities, hooks, services, reducers, parsers, validators, async flows, error handling, bug fixes, and refactors.
- Deciding whether a focused Vitest test should be added even when the user did not explicitly ask for tests.

## Core Rules

- When a task changes TypeScript production behavior, check whether a focused Vitest test should be added or updated before finalizing.
- Do not create tests mechanically. Add or update tests only when they verify meaningful public behavior, regression risk, edge cases, or refactoring safety.
- If existing tests already cover the change, run the relevant Vitest command and report that no new test was needed.
- Avoid this skill for docs-only, style-only, config-only, type-only, or test-only changes unless the user explicitly asks for test work.

## Workflow

1. Confirm the task touches TypeScript production code, not only docs, styles, config, types, or tests.
2. Inspect `package.json`, Vitest config, nearby tests, and existing test naming/location conventions.
3. Run the helper script when project setup is not already obvious.
4. Identify the behavior to protect: inputs, outputs, state transitions, errors, async outcomes, boundary conditions, and prior bug behavior.
5. Check existing tests before writing new ones.
6. Add or update the smallest useful Vitest test file using the project's existing style.
7. Run the most focused Vitest command first, usually the changed test file.
8. If production TypeScript or shared code changed, run the available typecheck command after the focused test.
9. Run broader tests only when the touched code has shared blast radius or the project convention expects it.
10. Report the test files changed, commands run, results, and any validation that could not be run.

## Implementation Guidelines

### Vitest Setup Policy

- Use Vitest as the test framework.
- If Vitest is already configured, follow the existing config and scripts.
- If Vitest is missing and no other test framework owns the project, add `vitest` as a development dependency using the detected package manager.
- If Jest, Playwright, Cypress, Mocha, Ava, or another runner already owns the test stack, do not migrate or mix frameworks silently. Report the conflict and ask for explicit direction.
- Do not add React Testing Library, jsdom, coverage tooling, or browser test dependencies unless the changed behavior requires them and the project already uses that style or the user explicitly asks.

### Test Authoring Rules

- Test public behavior, not private implementation details.
- Prefer direct assertions over snapshots. Use snapshots only when the project already uses them for the same kind of output.
- Cover meaningful branches and edge cases, especially error handling, empty input, invalid input, async rejection, boundary dates, parsing failures, and permission or state transitions.
- Keep mocks deterministic and local to the behavior under test.
- Use existing fixtures, factories, mock helpers, and naming patterns before creating new ones.
- Do not weaken assertions to make a failing test pass.
- If a new test exposes a production bug, keep the test and fix the implementation unless the user only asked for test authoring.

### When No New Test Is Needed

Skip new test creation and run relevant existing tests when:

- Existing Vitest coverage already protects the changed behavior.
- The change is type-only and cannot affect runtime behavior.
- The change is docs, comments, formatting, generated output, or visual class/style changes.
- The change only updates tests and does not alter production behavior.
- The user explicitly asks not to write or run tests.

State the reason when no new test is added.

## Tools And References

Run the helper script when project setup is not already obvious:

```bash
${PLUGIN_ROOT}/scripts/typescript-vitest.sh --project <project-root> --json
```

Use the target project's existing package manager, scripts, Vitest config, fixtures, and test conventions.

## Validation

Prefer commands in this order:

1. Single changed test file: `vitest run <test-file>`.
2. Related test group or package script.
3. Typecheck: existing `typecheck` script or `tsc --noEmit`.
4. Full Vitest suite or package `test` script when the touched code is shared.

If a command cannot run because dependencies are missing, the repo is not installed, or the project is not a TypeScript Vitest project, report that limitation clearly.

## Reporting

Report:

- whether a new test was added, an existing test was updated, or no new test was needed
- test files changed
- commands run and results
- any broader validation that was skipped and why
- dependency or test-runner conflicts that need user direction
