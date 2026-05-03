# Generated Files

## Project Root

```text
.env.example
.frontend-architecture.json
biome.json
package.json
tsconfig.json
scripts/boundary-check.ts
```

`biome.json` is generated only when `codeQuality` is `biome`.

## Env

```text
src/env/env.ts
src/env/env.schema.ts
```

Only public client env values are generated in the MVP.

Next.js App Router:

```text
NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

Expo Router:

```text
EXPO_PUBLIC_APP_ENV=local
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Path Alias

`tsconfig.json` maps:

```json
{
  "@/*": ["./src/*"]
}
```

Imports should use:

```ts
import { env } from "@/env/env";
import { logger } from "@/infrastructure/logging/logger";
```

Relative imports are allowed within nearby files, but the boundary check still resolves them and enforces layer direction.
