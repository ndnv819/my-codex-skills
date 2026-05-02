---
name: nextjs-initial-load-audit
description: Keep Next.js App Router initial loading fast through server-first boundaries, provider placement, safe lazy loading, official analyzer use, and production build verification. Use when working on Next.js App Router routes, layouts, Client Components, heavy UI libraries, code splitting, dynamic imports, bundle analysis, or frontend changes that may affect initial load.
argument-hint: "[--project path] [--no-build] [--json]"
---

# Next.js Initial Load Audit

Use this skill to keep App Router initial loading fast without inventing page-level kB thresholds.

## Core Rule

After meaningful App Router page, layout, Client Component, provider, dependency, or styling-library changes, run a production build and inspect initial-load risks before the final response.

Do not define a universal recommended page size. Current Next.js docs do not publish a numeric App Router route JavaScript budget, and Next.js 16 removed JS bundle size metrics from `next build`. Use project-defined budgets only when the project explicitly provides them.

Official reference points:

- `next build` verifies production compilation and route generation.
- `next experimental-analyze --output` is the official Turbopack bundle analysis path for route/import-chain inspection.
- Pages Router Large Page Data has an official `128 kB` warning, but that is serialized `__NEXT_DATA__` page data, not an App Router page JS budget.

Useful official references:

- https://nextjs.org/docs/app/api-reference/cli/next
- https://nextjs.org/docs/pages/guides/package-bundling
- https://nextjs.org/docs/messages/large-page-data

## Initial-Load Rules

### Server-First Boundary

Default to Server Components. Keep `page.tsx`, `layout.tsx`, and `template.tsx` server-first unless they truly need client interactivity. Move interactive pieces into small leaf Client Components.

Watch for:

- `'use client'` at page, layout, or template level
- client wrappers around entire routes
- server-only data fetching pushed into Client Components

### Provider Boundary

Do not put broad providers in the root layout unless every route needs them during initial render. Move auth, theme, query, tooltip, modal, toast, analytics, editor, or dashboard providers to the smallest subtree that needs them.

Root layout providers are especially sensitive because they can affect every route's initial client graph.

### Heavy Client Library Boundary

Avoid static initial-render imports for heavy browser/UI libraries:

- charts and dashboards
- maps and geospatial views
- rich text editors and code editors
- markdown, syntax highlighting, and diff rendering
- PDF, spreadsheet, import/export, and file preview tools
- 3D, animation, and visualization libraries

Prefer Server Components when the work does not need browser APIs. Otherwise use `next/dynamic` for below-the-fold UI or native `import()` inside user-triggered handlers.

### Above-The-Fold Boundary

Only load what the first meaningful viewport needs. Modals, drawers, tab contents, admin tools, inspectors, previews, export panels, and collapsed sections should be lazy candidates.

Do not lazy-load SEO-critical or visually essential first-viewport content unless the fallback is intentionally designed.

### Barrel Import Boundary

Avoid broad barrels such as `@/components` from route entry files. Prefer direct imports so unrelated Client Components and heavy dependencies do not join the route graph accidentally.

### Data And Streaming Boundary

Fetch only the fields needed to render. Keep large objects and lists out of Client Component props. Use pagination, `loading.tsx`, Suspense, and streaming for slower or non-critical sections.

### Asset And Script Boundary

Use `next/image` for first-viewport images when possible, `next/font` for fonts, and `next/script` with an explicit loading strategy for third-party scripts. Avoid loading analytics, widgets, or embeds on the critical path unless the page experience requires them immediately.

## Script

Run from the target Next.js project:

```bash
${PLUGIN_ROOT}/scripts/nextjs-app-router-performance.sh
```

Run against an explicit project:

```bash
${PLUGIN_ROOT}/scripts/nextjs-app-router-performance.sh --project <next-project>
```

Use JSON when exact risk data is useful:

```bash
${PLUGIN_ROOT}/scripts/nextjs-app-router-performance.sh --json
```

Inspect source and existing build output without rebuilding:

```bash
${PLUGIN_ROOT}/scripts/nextjs-app-router-performance.sh --no-build
```

## Analyzer Workflow

When route size or import chain needs deeper inspection, prefer the official analyzer:

```bash
pnpm next experimental-analyze --output
```

Use the project's package manager. For Webpack-based projects, use the existing `@next/bundle-analyzer` setup if present rather than adding a second analyzer.

## Safe Code-Splitting Patterns

For React components:

```tsx
import dynamic from "next/dynamic";

const ChartPanel = dynamic(() => import("./ChartPanel"), {
  loading: () => <div aria-busy="true" />
});
```

Use `ssr: false` only for browser-only components that depend on `window`, canvas, DOM APIs, or client-only libraries:

```tsx
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div aria-busy="true" />
});
```

For event-triggered non-component logic:

```tsx
async function exportWorkbook() {
  const XLSX = await import("xlsx");
  // export logic
}
```

## What Not To Auto-Fix

Do not automatically:

- move imports across server/client boundaries without checking behavior
- convert Server Components into Client Components
- lazy-load root navigation, primary layout, or first-viewport content blindly
- move side-effect imports, global CSS, fonts, metadata, route handlers, or server actions
- add arbitrary JavaScript budget thresholds

## Workflow

1. Identify the App Router project root by checking `package.json`, `next.config.*`, `app/`, and `src/app`.
2. Make the requested change using existing project style.
3. Run the performance script before finalizing.
4. Fix build failures first.
5. Review initial-load risks from the script.
6. Apply safe code splitting or boundary changes only when behavior is clear.
7. Rebuild after code-splitting edits.
8. Final response should state the build command, whether project-defined budgets were configured, and any initial-load risks left unresolved.
