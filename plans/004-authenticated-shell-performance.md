# Workstream 4: Authenticated Shell Performance

Priority: P1  
Owner: authenticated web performance agent  
Estimated size: M  
Depends on: Workstream 1 activation state names

## Goal

Make authenticated pages feel immediate by loading only the data and JavaScript needed for the current task.

The shell should not make every app route pay for notifications, sidebars, command palette, prompt submission, duplicate usage totals, and profile nudges before the main content is usable.

## Current Evidence

- `apps/web/app/(app)/layout.tsx` loads sidebar data, right-sidebar data, photo-nudge data, profile data, and shell state around every app page.
- `DeferredSidebar` and `DeferredRightSidebar` both call usage-total logic, creating duplicate work.
- `PhotoNudge` fetches latest posts separately from the sidebar.
- `apps/web/components/app/TopHeader.tsx` fetches `/api/notifications` and `/api/app/counts` immediately on mount.
- `apps/web/components/app/CommandPalette.tsx` imports `kbar`, mounts globally, and prefetches eight routes plus the profile route on mount.
- `apps/web/components/app/SubmitPromptWidget.tsx` is mounted in `ResponsiveShellFrame` for every app route even though its modal is not needed for first paint.
- Right sidebar suggestions and top users are useful, but they are not critical to feed/profile first content.

## In Scope

- `apps/web/app/(app)/layout.tsx`
- `apps/web/components/app/ResponsiveShellFrame.tsx`
- `apps/web/components/app/TopHeader.tsx`
- `apps/web/components/app/CommandPalette.tsx`
- `apps/web/components/app/SubmitPromptWidget.tsx`
- `apps/web/components/app/RightSidebar.tsx`
- `apps/web/lib/data/*`
- `apps/web/app/api/notifications/*`
- `apps/web/app/api/app/counts/route.ts`
- Tests for shell fetching and lazy loading

## Out of Scope

- Feed card redesign.
- Landing page performance.
- CLI changes.

## Implementation Instructions

1. Make main content the first priority.
   - Keep route content renderable without waiting on right sidebar, photo nudge, prompt modal, or full notification list.
   - Use Suspense boundaries with small skeletons for secondary panels.
2. Remove duplicate usage-total work.
   - Load usage totals once per request when both left and right panels need them.
   - Pass the result down or split right-sidebar requirements so it does not need totals on routes where they are not visible.
3. Defer notification list fetching.
   - Fetch only the unread count on initial shell render.
   - Fetch the full notification list only when the user opens the notification menu.
   - In React Query, use an `enabled` condition tied to menu open state.
4. Lazy-load the command palette.
   - Do not import `kbar` into the initial app-shell bundle.
   - Load the command palette on first `Cmd+K`/`Ctrl+K`, on explicit search button activation, or during idle time after the main content is interactive.
   - Remove eager route prefetches on mount. If prefetching remains, do it after idle and only for the two most likely next routes.
5. Lazy-load prompt submission.
   - Keep the quick action visible only where it supports the current task.
   - Defer modal internals until the user opens it.
   - Hide or deprioritize the prompt widget for users who have not completed first sync.
6. Make sidebars adaptive.
   - Do not fetch desktop-only right-sidebar data on mobile.
   - On desktop, stream right-sidebar content after main content.
   - Keep sidebar failures isolated from the main route.
7. Add fetch regression tests.
   - A feed page render must not request the full notifications list before the notification menu opens.
   - A feed page render must not load command-palette JavaScript before shortcut or idle trigger.
   - A mobile feed render must not request right-sidebar-only data.

## Verification Commands

```bash
bun --cwd apps/web test -- components/app
bun --cwd apps/web test -- app/api/notifications app/api/app/counts
bun --cwd apps/web test:e2e -- e2e/authenticated-100ms.test.tsx
bun --cwd apps/web typecheck
bun --cwd apps/web build
```

Manual measurement:

```bash
bun --cwd apps/web dev
```

Open `/feed` and `/u/[username]` with the browser network panel. Confirm non-critical requests do not fire before interaction and the main content appears before secondary panels finish.

## Done Criteria

- Main authenticated route content renders without waiting for secondary panels.
- Full notification list fetches only after the menu opens.
- Command palette code is not part of the initial route bundle unless loaded after idle.
- Mobile app routes do not fetch desktop-only sidebar data.
- Duplicate usage-total fetches are removed or explicitly justified.
- Route bundle and network measurements are documented in the PR.

## Stop Conditions

- Stop if shell deferral causes hydration mismatches or navigation focus traps.
- Stop if notification count and list can become inconsistent without a cache invalidation plan.
- Stop if route-specific data ownership becomes unclear; prefer smaller helper APIs over a single large shell loader.
