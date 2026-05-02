---
name: react-render-optimization
description: Analyze and optimize React render performance. Use when asked to profile slow React UI, reduce unnecessary re-renders, fix laggy forms or lists, improve component render cost, review memoization, stabilize props or callbacks, tune hooks/effects/context usage, or validate a React component performance change.
---

# React Render Optimization

Use this skill to make targeted React component performance improvements without changing user-visible behavior.

## Core Approach

1. Establish the slow interaction, affected component, input size, and expected behavior.
2. Inspect the component tree and data flow before changing code.
3. Identify the render trigger: local state, parent state, context updates, prop identity churn, effects, subscriptions, timers, scroll/input events, or async data changes.
4. Apply the smallest optimization that removes the measured cost.
5. Validate with profiling, tests, or a focused reproduction.

Prefer evidence over blanket optimization. Do not add `memo`, `useMemo`, or `useCallback` unless prop identity or computation cost actually matters.

## Investigation Checklist

- Check whether the slow path is render time, commit/layout time, network/data loading, bundle loading, or expensive synchronous work.
- Use React DevTools Profiler when a browser is available. Capture a baseline before editing.
- Search for state colocated too high in the tree, especially state updated by typing, polling, timers, animation, resize, or scroll.
- Look for props recreated on every render: inline objects, arrays, functions, component definitions, style objects, options objects, and derived collections.
- Check context providers whose `value` changes frequently and forces broad subtree updates.
- Inspect effects that set state repeatedly or depend on unstable values.
- Review list rendering: item count, key stability, row component cost, hidden item rendering, and virtualization opportunities.
- Check expensive render work: sorting, filtering, Markdown rendering, syntax highlighting, diff rendering, date formatting loops, or schema validation.
- Confirm keys are stable and not index-based when order can change.

## Optimization Patterns

### Move Fast State Down

Keep high-frequency state close to the UI that actually needs it. A parent containing heavy children should not re-render on every keystroke, tick, hover, resize, or scroll event unless those children depend on that state.

### Narrow Component Props

Pass primitive or narrow props where possible. A memoized child receiving a large object that is rebuilt each render still re-renders.

### Stabilize Identities Deliberately

Use `useCallback` for handlers passed to memoized children or dependency-sensitive hooks. Use `useMemo` for expensive derived values or stable object/array props. Avoid using either only to silence lint warnings.

### Split Context

Separate frequently changing context values from stable actions/configuration. Memoize provider values and split providers when unrelated consumers are forced to update together.

### Virtualize Long Lists

For large lists, tables, logs, chat histories, search results, or grids, avoid rendering offscreen rows.

Default library choices:
- React Web: use `@tanstack/react-virtual`.
- React Native, including Expo: use `@shopify/flash-list`.
- Existing projects: if a virtualization library is already installed and used consistently, prefer that library instead of adding a second one.

Do not hand-roll virtualization unless the UI constraints cannot be handled by the default platform library.

### Defer Heavy UI

Lazy-render expensive panels, collapsed sections, previews, charts, Markdown, syntax highlighting, or diff views until visible or expanded.

### Keep Effects Boring

Effects should not create render loops. Stabilize dependencies, move pure derivation into render or `useMemo`, and avoid state updates in effects when the value can be computed directly.

## Validation

Use the strongest validation available in the project:

- React DevTools Profiler: compare render counts and durations against the baseline.
- Browser reproduction: verify the slow interaction feels improved and UI behavior is unchanged.
- Tests: run relevant unit/component/e2e tests.
- Static checks: run the repo's lint/typecheck/build commands when touched code is TypeScript or shared UI infrastructure.

When profiling is not available, state that limitation and validate through code reasoning plus project tests.

## Reference Files

Load `references/examples.md` when you need concrete React refactor patterns or snippets.
