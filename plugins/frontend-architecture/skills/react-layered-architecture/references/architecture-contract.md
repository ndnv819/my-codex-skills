# Architecture Contract

This skill targets React-based frontend projects using Next.js App Router or Expo Router.

The architecture is layer-first with feature-based presentation.

Layers:

1. `presentation`
2. `application`
3. `infrastructure`

The `presentation` layer is the top layer. The `infrastructure` layer is the bottom layer.

Higher layers may import lower layers. Lower layers must not import higher layers.

`src/env` is outside the application layers and may be imported by any layer. It must not import application code.

## Required Source Shape

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
    providers/
  application/
    hooks/
  infrastructure/
    logging/
    network/
    helpers/
    retry/
```

## Explicit Non-Goals

- Do not create a domain layer.
- Do not create `features` under `application`.
- Do not create `features` under `infrastructure`.
- Do not turn this into a UI library selector.
- Do not turn this into an app feature preset generator.
