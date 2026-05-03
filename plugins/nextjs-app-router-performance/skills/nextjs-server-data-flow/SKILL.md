---
name: nextjs-server-data-flow
description: Guide Next.js App Router data fetching and mutation work toward Server Components, server-side fetch or direct data access, Server Actions, explicit cache/revalidation, and limited client query library use. Use when building, reviewing, or refactoring Next.js App Router features, replacing useQuery, designing forms or mutations, setting cache policy, or deciding Server and Client Component boundaries.
---

# Next.js Server Data Flow

## Purpose

Use this skill for Next.js App Router projects where ordinary app data should stay server-first by default.

## Use When

- Building, reviewing, or refactoring Next.js App Router data reads, forms, mutations, or route-level data flow.
- Replacing or evaluating `useQuery`, client fetches, internal Route Handlers, Server Actions, or cache revalidation.
- Deciding where Server Components, Client Components, Route Handlers, and server-only services should own behavior.

## Core Rules

- Prefer Server Components for initial reads and server-owned data. Use `fetch`, ORM/database clients, or service functions from the server side instead of moving page data loading into Client Components with `useQuery`.
- Prefer Server Actions for app-owned mutations. Server Actions should perform authentication, authorization, validation, persistence, cache invalidation, and redirects on the server.
- Do not treat `useQuery` as the default data loading primitive in App Router code. Use it only when a specific client-side cache or refetch behavior is required.
- If a project is on the Pages Router or an older Next.js version, adapt cautiously and state the routing/version assumption before refactoring.

## Workflow

1. For initial page or layout data, load it in a Server Component with `await fetch(...)`, an ORM/database call, or a server-only service.
2. For create, update, delete, submit, or command-style work, use a Server Action.
3. For external public HTTP endpoints, webhooks, third-party callbacks, or non-UI API contracts, use a Route Handler.
4. For interactive UI state, keep only the smallest necessary leaf component behind `"use client"`.
5. Reach for React Query only after documenting the client-owned behavior that requires it.
6. Validate the result with the strongest relevant project checks.
7. Report the boundary choices, validation commands, and any assumptions.

## Implementation Guidelines

### Server Reads

- Keep data reads close to the route segment that needs them.
- Make cache intent explicit with `fetch` options such as `cache`, `next.revalidate`, or `next.tags`.
- Use `Promise.all` for independent server reads that can run in parallel.
- Use `loading.tsx`, Suspense, or streaming boundaries for slow or independently loading regions.
- Do not create internal `app/api/*` endpoints solely so Client Components can call them for ordinary page data.
- Keep secrets, tokens, database clients, and privileged service calls on the server.

### Server Actions

- Put mutation logic in functions marked with `"use server"` or in server-only action modules.
- Validate inputs inside the action. Prefer schema validation when the project already uses a schema library.
- Re-check authentication and authorization inside every action, even if the UI hides the control.
- Use `revalidatePath` or `revalidateTag` when mutation results affect cached server data.
- Use `redirect` when the successful mutation should navigate.
- Use `useActionState`, `useFormStatus`, and `<form action={...}>` for forms before building custom client mutation state.

### Client Components

- Add `"use client"` only for components that need browser APIs, event handlers, local interactive state, refs, effects, or client-only libraries.
- Pass server-fetched data into Client Components as serializable props when the client only needs to render or interact with already-loaded data.
- Do not promote a large route, layout, or data-heavy parent to a Client Component just to use a hook.
- Keep client state separate from server truth. Avoid duplicating server data in client state unless there is an explicit editing or optimistic UI flow.

### React Query Exceptions

React Query or another client query library can be appropriate when the feature requires:

- polling or frequent client-driven refetch
- infinite scrolling or paginated client cache management
- offline persistence or reconnect behavior
- optimistic UI with complex rollback requirements
- realtime-like browser-owned freshness behavior
- a third-party client SDK that cannot run on the server
- a large existing React Query surface where consistency is more important than a one-off refactor

When allowing React Query, explain why server-side `fetch`, Server Actions, and cache revalidation are insufficient. Prefer server prefetch/hydration patterns when the first view needs SSR consistency.

### Review Checklist

- Is `useQuery` being used for initial route data that could be loaded in a Server Component?
- Is `"use client"` higher in the component tree than necessary?
- Are internal Route Handlers being created only to support browser-side app data fetching?
- Does every server `fetch` have a deliberate caching strategy?
- Do mutations validate input and re-check permissions on the server?
- Do mutations invalidate the correct path or tag after writes?
- Are slow reads handled with Suspense, `loading.tsx`, or parallelization instead of client waterfalls?
- Is any React Query usage justified by client-owned freshness, pagination, offline, realtime, or optimistic behavior?

### Preferred Refactors

Replace Client Component initial reads:

```tsx
// Avoid for ordinary App Router page data.
"use client";

const { data } = useQuery({
  queryKey: ["projects"],
  queryFn: () => fetch("/api/projects").then((res) => res.json()),
});
```

with Server Component reads:

```tsx
export default async function ProjectsPage() {
  const projects = await fetchProjects();

  return <ProjectsList projects={projects} />;
}
```

Replace client mutation wrappers:

```tsx
// Avoid when this only proxies an app-owned write to an internal endpoint.
const mutation = useMutation({
  mutationFn: (input) => fetch("/api/projects", { method: "POST", body: JSON.stringify(input) }),
});
```

with Server Actions:

```tsx
"use server";

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const input = parseProjectForm(formData);

  await insertProject(user.id, input);
  revalidatePath("/projects");
}
```

## Tools And References

- No bundled helper script is required for this skill.
- Use the target repository's TypeScript, lint, test, and build commands to validate server/client boundaries and runtime behavior.
- Prefer existing project service functions, schema validators, auth helpers, and cache tagging conventions before adding new abstractions.

## Validation

Use the strongest checks available in the repository:

- TypeScript typecheck for server/client boundary issues.
- Lint for hook misuse and import boundary problems.
- Unit or integration tests for service functions and Server Actions.
- Browser or e2e checks for form behavior, redirects, loading states, and cache refresh after mutation.

## Reporting

Report:

- whether reads were kept server-side or intentionally moved client-side
- where mutations live and how they validate, authorize, and revalidate
- any React Query usage that remains and why it is justified
- commands run and results
- routing or Next.js version assumptions
