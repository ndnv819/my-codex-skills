---
name: storybook-auto-composer
description: Install, configure, complete, and validate usable Storybook setups for React and Next.js projects. Use when asked to make Storybook work, add Storybook from scratch, generate or improve .stories.tsx files, support Next.js App Router stories, wire MSW API mocks, add play-function interactions, generate visual regression screenshot baselines, or fix Storybook build/runtime failures.
---

# Storybook Auto Composer

## Purpose

Use this skill to bring a React or Next.js project to a genuinely usable Storybook state. The goal is to make Storybook run, build, render realistic component states, mock app runtime dependencies, exercise meaningful interactions, and produce visual baselines when requested.

## Use When

- Installing, repairing, upgrading, or validating Storybook in a React or Next.js project.
- Generating or improving `.stories.tsx` files with realistic variants, fixtures, decorators, and interactions.
- Supporting Next.js App Router components, MSW API mocks, visual screenshot baselines, or Storybook build/runtime failures.

## Core Rules

- Complete Storybook setup work only when the strongest feasible checks pass or a real blocker is identified.
- Reuse or represent existing providers, themes, global CSS, design-system decorators, i18n, data clients, router wrappers, static assets, and mock conventions.
- Generate stories after bootstrap and runtime mock foundations are understood, not at plugin installation time.
- Avoid broad dependency churn. Add only the packages required for Storybook, MSW, interaction tests, or screenshot baselines.
- Do not weaken stories or remove useful coverage only to make a build pass.

## Workflow

1. Inspect the target project before editing.
2. Run the inventory helper when available.
3. Detect package manager, framework, Storybook version, builder, TypeScript, React, Next.js, App Router, global styles, providers, existing stories, existing Storybook config, MSW setup, Playwright or browser-test setup, and package scripts.
4. If Storybook is missing, bootstrap it before generating stories. Prefer the official Storybook initializer and the target project's package manager.
5. Preserve existing `.storybook/main.*`, `.storybook/preview.*`, decorators, global CSS imports, addon choices, and framework configuration. Extend them deliberately instead of replacing them.
6. Prepare runtime foundations: app providers, theme providers, CSS, router state, Next.js parameters, MSW loader, static assets, public directory, and deterministic fixtures.
7. Generate or improve `.stories.tsx` files only after Storybook setup and mock foundations are understood.
8. Add `play` functions for deterministic interactions.
9. Generate visual baselines when requested or when visual regression setup is part of the task.
10. Run validation, fix failures, and repeat until the setup is usable or a real blocker is identified.

## Implementation Guidelines

### Completion Criteria

A task is complete only when the strongest feasible checks pass:

- Storybook is installed and configured when it was missing.
- The target project has runnable `storybook` and `build-storybook` scripts, or equivalent existing scripts are preserved and documented.
- Next.js App Router components do not fail in Storybook because of `next/navigation`, `next/link`, `next/image`, `next/font`, routing context, or browser-incompatible module assumptions.
- Existing providers, themes, global CSS, design-system decorators, i18n, data clients, and router wrappers are reused or represented in `.storybook/preview.*`.
- Existing MSW handlers are connected to Storybook; if no MSW setup exists and API-dependent stories need it, a minimal MSW Storybook setup is added.
- Important component candidates have executable `.stories.tsx` coverage with meaningful variants, not only a default render.
- Interactive components have `play` functions when the behavior can be exercised deterministically.
- Requested or appropriate visual screenshot baselines are generated for stable stories.
- `build-storybook` passes, and any available relevant lint, typecheck, Storybook test, or browser check has been run or clearly reported as unavailable.

### Bootstrap Policy

When Storybook is not installed:

- Use the detected package manager and existing lockfile.
- Use the official initializer with an explicit project type when framework detection may fail.
- For Next.js, default to the Next.js Storybook framework and prefer `@storybook/nextjs-vite` for modern projects unless custom Webpack or Babel constraints make `@storybook/nextjs` safer.
- Add or preserve package scripts for running and building Storybook.
- Remove tutorial/example stories only when they are clearly generated noise and the project does not use them.
- Avoid broad dependency churn. Add only the packages required for Storybook, MSW, interaction tests, or screenshot baselines.

If Storybook exists:

- Do not reinitialize it blindly.
- Read current config, story globs, addons, framework package, preview decorators, static dirs, and manager config.
- Upgrade or migrate only when necessary to satisfy the user's request or fix a concrete breakage.

### Next.js App Router Support

For Next.js projects:

- Detect `app/` or `src/app/` and usage of `next/navigation`.
- Set `parameters.nextjs.appDirectory = true` globally when the project is App Router first; otherwise set it per story or per component.
- Use Storybook's Next.js framework support for `next/image`, `next/font`, `next/link`, route aliases, CSS modules, Sass, and Next config integration before adding manual mocks.
- Add per-story `parameters.nextjs.navigation` when a component needs a specific pathname, query, or route state.
- Mock browser-incompatible modules with Storybook module mocking or local test doubles only when the framework support does not cover the issue.
- Do not import Next.js server-only pages, route handlers, or server actions directly into client-rendered stories unless a safe wrapper already exists.
- For React Server Components, only enable experimental Storybook support when the installed framework and project setup support it; otherwise create stories around client-compatible leaf components.

### MSW API Mocking

For API-dependent components:

- Search for existing `msw`, `msw-storybook-addon`, `handlers`, `mocks`, `fixtures`, `server`, `worker`, and API client patterns.
- Reuse existing request handlers and fixture factories whenever possible.
- If MSW exists but Storybook is not wired, add `initialize` and `mswLoader` to `.storybook/preview.*` and include the public directory in `staticDirs` when the service worker must be served.
- If MSW is missing and stories need network mocks, add `msw` and `msw-storybook-addon` as dev dependencies, initialize the service worker under the project's public asset directory, and create minimal handlers near existing mock conventions.
- Prefer story-level `parameters.msw.handlers` for component-specific states such as success, loading, empty, unauthorized, validation error, and server error.
- Keep unhandled network behavior explicit. Avoid stories that silently call real production APIs.

### Story Authoring Rules

- Match the project's existing story file location, naming, imports, formatting, and story style.
- If no convention exists, colocate `Component.stories.tsx` beside `Component.tsx` for local components.
- Import `Meta` and `StoryObj` from the configured Storybook framework package or from the existing project convention.
- Use `satisfies Meta<typeof Component>` when the project uses TypeScript.
- Prefer typed `args` over custom wrapper components for simple prop states.
- Generate meaningful variants from prop types, variant maps, design-system options, boolean props, loading/error/empty states, and common UX states.
- Use deterministic fixture data. Do not use randomness, current time, production network calls, or environment-specific secrets in stories.
- Avoid huge generated data unless the component specifically needs virtualization, pagination, or overflow coverage.
- Do not change component behavior only to make a story easier unless the behavior is clearly broken and the user asked for fixes.
- When a component requires a provider, add a local decorator or shared preview decorator that matches existing app infrastructure.

### Interaction Stories

Add `play` functions when a user-level interaction is stable and valuable:

- Forms: type, clear, submit, validate, and assert result text or callback.
- Menus, dialogs, popovers, tabs, accordions, comboboxes, and dropdowns: open, select, close, and assert visible state.
- Buttons and toggles: click and assert callback or state change.
- Async UI: wait for mocked API result with deterministic MSW handlers.

Prefer imports from `@storybook/test` for `within`, `userEvent`, `expect`, `waitFor`, and `fn` in modern Storybook projects. Match existing legacy imports if the project already uses older Storybook interaction patterns.

Do not add brittle interactions that depend on layout coordinates, animation timing, random IDs, or external services.

### Visual Baselines

When visual regression baselines are in scope:

- Prefer an existing visual testing setup if the project already has Chromatic, Playwright screenshots, Loki, or Storybook test-runner snapshots.
- Capture stable, meaningful stories first.
- Skip stories that depend on time, random data, animated loading loops, media streams, external images without stable mocks, or intentionally responsive layouts unless viewport-specific baselines are configured.
- Store baselines in a project-local path that matches existing conventions. If none exists, use `.storybook/visual-baselines/`.
- Document the command needed to regenerate baselines.

## Tools And References

Run the inventory helper:

```bash
${PLUGIN_ROOT}/scripts/storybook-inventory.sh --project <project-root> --json
```

Generate local screenshot baselines from a running Storybook instance:

```bash
${PLUGIN_ROOT}/scripts/storybook-screenshots.sh \
  --project <project-root> \
  --url http://127.0.0.1:6006 \
  --out .storybook/visual-baselines
```

The intended task order is:

```text
scan -> bootstrap/configure -> runtime mocks/providers -> component inventory -> stories -> interactions -> visual baselines -> validation/fix loop
```

## Validation

Run the narrowest useful checks first and broaden only as needed:

- `build-storybook` or the existing equivalent script.
- Storybook dev server browser check when runtime failures are likely.
- Typecheck when TypeScript config or stories changed.
- Lint when project convention expects generated code to pass lint.
- Storybook test runner or interaction tests when available.
- Screenshot baseline capture after the dev server renders correctly.

If validation fails, inspect the actual failing story, config, or module and fix it.

## Reporting

Report:

- whether Storybook was installed or reused
- config files changed
- story files created or improved
- Next.js and MSW support added
- interaction and visual baseline coverage added
- commands run and results
- any stories/components intentionally skipped and why
