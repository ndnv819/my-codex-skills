# React Performance

React performance assistant for profiling, render optimization, memoization review, list tuning, and validation guidance.

## Overview

- Profiles slow React UI and identifies the render trigger.
- Reduces unnecessary re-renders without changing user-visible behavior.
- Stabilizes props, callbacks, memoized values, context values, and effects when evidence supports it.
- Guides list optimization, virtualization, and lazy rendering for expensive UI.
- Validates improvements with profiling, focused browser checks, tests, or static checks.

## Included Skills

| Skill | Purpose |
| --- | --- |
| `react-render-optimization` | Diagnose slow React components, reduce unnecessary re-renders, stabilize props/callbacks, optimize lists, and validate improvements. |

## Usage

Use this plugin when profiling slow React UI, fixing laggy forms or lists, improving render cost, reviewing memoization, stabilizing hooks or context usage, or validating a React component performance change.

## Scripts

This plugin does not include standalone scripts. Use the included skill for implementation and review guidance.

## Notes

Prefer evidence over blanket optimization. Do not add `memo`, `useMemo`, or `useCallback` unless prop identity or computation cost actually matters.

This plugin is registered in this repository's `.agents/plugins/marketplace.json`.
