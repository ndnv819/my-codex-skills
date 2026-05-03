# Options

The MVP keeps options limited to architecture generation concerns.

## `appFramework`

Default: `nextjs-app-router`

Values:

- `nextjs-app-router`
- `expo-router`

Effects:

- Selects framework-specific route entries.
- Selects the public env prefix.
- Selects framework dependencies and scripts.

Env prefixes:

- `nextjs-app-router`: `NEXT_PUBLIC_`
- `expo-router`: `EXPO_PUBLIC_`

## `packageManager`

Default: `pnpm`

Values:

- `pnpm`
- `npm`
- `yarn`
- `bun`

Install command mapping:

- `pnpm`: `pnpm install`
- `npm`: `npm install`
- `yarn`: `yarn install`
- `bun`: `bun install`

## `codeQuality`

Default: `biome`

Values:

- `biome`
- `none`

When `biome` is selected, generate `biome.json`, add `@biomejs/biome`, and include format/lint/check scripts.
