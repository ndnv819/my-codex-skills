# Boundary Rules

Allowed:

- `presentation` imports `presentation`
- `presentation` imports `application`
- `presentation` imports `infrastructure`
- `presentation` imports `env`
- `application` imports `application`
- `application` imports `infrastructure`
- `application` imports `env`
- `infrastructure` imports `infrastructure`
- `infrastructure` imports `env`
- `env` imports `env`

Forbidden:

- `application` imports `presentation`
- `infrastructure` imports `application`
- `infrastructure` imports `presentation`
- `env` imports `presentation`
- `env` imports `application`
- `env` imports `infrastructure`

## Required Checks

The project-local `scripts/boundary-check.ts` must:

- Parse TypeScript and JavaScript source files.
- Inspect static imports, re-exports, dynamic imports, and `require(...)`.
- Resolve `@/*` aliases to `src/*`.
- Resolve relative imports to real files.
- Determine source and target layers from paths under `src`.
- Print file, line, column, import specifier, and resolved target when a violation is found.
- Exit with code `1` when violations exist.

## Audit Checks

`audit-architecture` should also check:

- Required layer directories exist.
- Forbidden feature directories do not exist.
- `.env.example` exists at the project root.
- `src/env/env.ts` and `src/env/env.schema.ts` exist.
- `compilerOptions.strict` is `true`.
- `@/*` maps to `./src/*`.
- `biome.json` exists when `codeQuality` is `biome`.
- Direct `process.env` usage exists only inside `src/env`.
