---
name: react-layered-architecture
description: Scaffold, design, extend, and audit React frontend project structures using Next.js App Router or Expo Router with a src-based presentation, application, infrastructure, and env architecture. Use when creating or building a Next.js App Router project structure, Expo Router project structure, layered React app, feature UI module, architecture boundary check, import boundary audit, strict TypeScript setup, root env validation, Biome setup, or @/* path alias setup.
argument-hint: "scaffold-project <name> | add-feature <name> | audit-architecture [--project path] | boundary-check [--project path]"
---

# React Layered Architecture

## Purpose

Use this skill to create and maintain React frontend projects with a consistent layer-first architecture and feature-based presentation structure.

## Use When

- Creating a new Next.js App Router or Expo Router project with a predefined frontend architecture.
- Adding a feature UI module under `src/presentation/features`.
- Auditing an existing project for layer structure, env access, TypeScript strict mode, `@/*` path alias, Biome config, or import direction violations.
- Generating or running an architecture boundary check that resolves both alias and relative imports.

## Core Rules

- Target React-based projects only. Supported frameworks are Next.js App Router and Expo Router.
- Use `presentation`, `application`, and `infrastructure` as the only application layers.
- Keep feature folders only under `src/presentation/features`.
- Do not create a domain layer.
- Keep env access under `src/env`, with `.env.example` at the project root.
- Use TypeScript strict mode and map `@/*` to `./src/*`.
- Allow `presentation` to import `application`, `infrastructure`, and `env`.
- Allow `application` to import `infrastructure` and `env`.
- Allow `infrastructure` to import `env`.
- Forbid lower layers from importing higher layers.
- Keep supported scaffold options limited to `appFramework`, `packageManager`, and `codeQuality`.
- Do not ask for UI library options or app feature preset options.

## Workflow

1. Identify whether the task is scaffold, feature addition, architecture audit, or boundary validation.
2. Use the bundled CLI instead of manually creating architecture files when possible.
3. For scaffold work, choose defaults unless the user specifies otherwise: `nextjs-app-router`, `pnpm`, and `biome`.
4. For feature work, create UI under `src/presentation/features/<feature>` and hooks under `src/application/hooks`.
5. For audit work, inspect structure, forbidden feature folders, env location, `tsconfig.json`, Biome config, direct `process.env` usage, and import boundaries.
6. Run the strongest relevant validation command available.
7. Report generated files, commands run, and any remaining violations or skipped checks.

## Implementation Guidelines

### Architecture Contract

The default source shape is:

```text
src/
  env/
    env.ts
    env.schema.ts
  presentation/
    components/
      atoms/
      molecules/
      organisms/
    features/
      home/
    providers/
  application/
    hooks/
  infrastructure/
    logging/
    network/
    helpers/
    retry/
```

Load `references/architecture-contract.md` when the full layer contract or generated directory shape is needed.

### Options

Supported scaffold options are:

- `appFramework`: `nextjs-app-router` or `expo-router`
- `packageManager`: `pnpm`, `npm`, `yarn`, or `bun`
- `codeQuality`: `biome` or `none`

Load `references/options.md` when option defaults, env prefixes, or package-manager command mapping are needed.

### Env And Alias

Generate root `.env.example` and `src/env/env.ts` plus `src/env/env.schema.ts`.

Use public env prefixes:

- Next.js App Router: `NEXT_PUBLIC_`
- Expo Router: `EXPO_PUBLIC_`

Use this alias contract:

```json
{
  "@/*": ["./src/*"]
}
```

Load `references/generated-files.md` when exact generated files or env examples are needed.

### Boundary Checks

Boundary checks must resolve import targets before comparing layers. Do not rely on `tsconfig.json` alone for enforcement.

The generated project-local checker should inspect:

- static imports
- re-exports
- dynamic imports
- `require(...)`
- `@/*` alias imports
- relative imports

Load `references/boundary-rules.md` when exact allowed/forbidden imports or audit checks are needed.

## Tools And References

Run from the plugin root:

```bash
./scripts/frontend-architecture.sh scaffold-project <project-name>
./scripts/frontend-architecture.sh add-feature <feature-name> --project <project-root>
./scripts/frontend-architecture.sh audit-architecture --project <project-root>
./scripts/frontend-architecture.sh boundary-check --project <project-root>
```

Scaffold examples:

```bash
./scripts/frontend-architecture.sh scaffold-project my-app
./scripts/frontend-architecture.sh scaffold-project my-app --app-framework expo-router --package-manager npm --code-quality none
```

Feature example:

```bash
./scripts/frontend-architecture.sh add-feature travelSchedule --project my-app --with-api
```

References:

- `references/architecture-contract.md`
- `references/options.md`
- `references/generated-files.md`
- `references/boundary-rules.md`

## Validation

For generated projects, run the generated project check script when dependencies are installed:

```bash
<package-manager> run check
```

Use the bundled audit when validating from the plugin:

```bash
./scripts/frontend-architecture.sh audit-architecture --project <project-root>
```

If dependencies are not installed, scaffold and structure checks can still be inspected, but TypeScript-backed boundary checks may require install first.

## Reporting

Report:

- framework, package manager, and code-quality options used
- files or directories generated
- whether `@/*`, strict TypeScript, env files, and boundary checks were configured
- validation commands run and results
- architecture violations found or checks skipped because dependencies were unavailable
