# Workstream 3: Public Landing Performance

Priority: P1  
Owner: landing and public performance agent  
Estimated size: M  
Depends on: Workstream 1 for event names only

## Goal

Make the public landing page load quickly and explain the activation loop immediately.

The landing page should feel premium without paying for app-shell JavaScript, live analytics aggregation, or below-the-fold motion before the user has interacted.

## Current Evidence

- `apps/web/app/layout.tsx` wraps all routes in `PostHogClientProvider`, `QueryProvider`, and `ThemeProvider`.
- `PostHogProvider.tsx` imports `posthog-js` and `posthog-js/react` in a global client provider even though initialization is consent-gated.
- PostHog's web provider is correctly consent-gated and proxied through `/ingest`, but project-side `$pageview` capture was stale during the 2026-06-16 check. Do not remove PostHog while slimming the landing page; fix and verify the lazy/consent path.
- `apps/web/app/(landing)/page.tsx` renders the landing page inside a full-screen scroll container, loads `LazyHalftoneCanvas`, and calls `getTickerStats()`.
- `getTickerStats()` calls `getOpenStatsForPage()`, then reads `leaderboard_weekly`.
- `apps/web/lib/open-stats.ts` live path fetches up to 50,000 `daily_usage` rows plus admin aggregates before snapshot fallback.
- `apps/web/components/landing/Hero.tsx` is a client component only because the command copy button needs `useState`.
- `apps/web/components/landing/Hero.tsx` uses `npx straude`, while onboarding uses `npx straude@latest`, and the final CTA section uses `npx straude push --days 7`.
- `apps/web/components/landing/CTASection.tsx` contains persuasive copy but no actual primary signup or command-copy action.
- `apps/web/components/landing/ProductHuntBadge.tsx` loads a remote SVG image from Product Hunt in the hero.
- The stale `.next/diagnostics/route-bundle-stats.json` snapshot showed `/` at roughly 1.46 MB uncompressed first-load JS. Treat this as supporting evidence only; regenerate before measuring success.

## In Scope

- `apps/web/app/layout.tsx`
- Landing route-group layouts under `apps/web/app/(landing)`
- `apps/web/components/providers/*`
- `apps/web/components/landing/*`
- `apps/web/lib/open-stats.ts`
- Snapshot or cron code that refreshes open stats
- Landing tests and bundle measurement scripts

## Out of Scope

- Authenticated app-shell performance.
- CLI behavior.
- Major brand rewrite.

## Implementation Instructions

1. Split public and authenticated providers.
   - Keep the root layout as server-first and minimal.
   - Move `QueryProvider`, authenticated PostHog auth-listener behavior, command-palette dependencies, and other app-only providers into the authenticated route group.
   - Keep consent UI where required, but avoid importing analytics libraries on the first public render if consent is unknown.
   - Preserve a lazy public PostHog bootstrap for users who accept analytics. The public route must still capture `$pageview`, `landing_primary_cta_clicked`, and `sync_command_copied` after consent.
2. Convert landing sections to server components by default.
   - Make `Hero` a server component.
   - Extract only the copy button into a tiny client island.
   - Avoid `motion/react` above the fold unless it is proven not to affect first-load JS materially.
3. Defer expensive visual effects.
   - Load `LazyHalftoneCanvas` after idle, after first interaction, or when the hero is stable.
   - Provide a static CSS or image fallback that preserves visual quality.
   - Respect reduced-motion and low-power conditions before initializing WebGL.
4. Move social proof and remote images below the critical path.
   - Replace the Product Hunt remote badge with a local optimized asset, or lazy-load it below the first CTA.
   - Keep wall-of-love content below the fold and remove per-card motion from the initial bundle.
5. Make ticker data snapshot-first.
   - Public landing render must read the latest open-stats snapshot first.
   - Live aggregation belongs in a scheduled refresh, admin action, or background regeneration path.
   - Preserve the stale snapshot fallback policy described in `docs/DECISIONS.md`.
   - Do not query tens of thousands of `daily_usage` rows from the landing render path.
6. Tighten the landing activation loop.
   - Use one command everywhere: `npx straude@latest`.
   - The hero CTA should lead to signup and make the CLI loop visible.
   - The final CTA must include a real signup link and copyable command.
   - Do not send new users toward secondary surfaces before signup and first sync.
7. Wire landing analytics into PostHog.
   - Capture `landing_primary_cta_clicked` with `surface`, `cta_location`, `destination`, and `has_analytics_consent`.
   - Capture `sync_command_copied` with `surface: "landing"` and `command: "npx straude@latest"`.
   - Keep these captures in tiny client islands, not in large page-level client components.
   - Verify accepted-cookie sessions produce `$pageview` through `/ingest`.
8. Add measurable budgets.
   - Regenerate Next bundle diagnostics after a production build.
   - Set a target of at least 50% lower first-load uncompressed JS for `/` than the stale 1.46 MB snapshot, or document why a smaller reduction is the practical limit.
   - Capture Lighthouse or Playwright timing for `/` before and after.

## Verification Commands

```bash
bun --cwd apps/web build
bun --cwd apps/web test -- components/landing
bun --cwd apps/web test:e2e -- e2e/landing-to-signup.spec.ts
bun --cwd apps/web typecheck
```

Bundle and route checks:

```bash
find apps/web/.next/diagnostics -maxdepth 1 -type f -print
node -e "const s=require('./apps/web/.next/diagnostics/route-bundle-stats.json'); console.log(s.find(r=>r.route==='/'))"
```

If the diagnostics schema changes, use the current Next build artifact that reports per-route first-load JS and document the replacement command.

PostHog check after deploying the landing change:

```sql
SELECT event, count() AS count, max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND event IN ('$pageview', 'landing_primary_cta_clicked', 'sync_command_copied')
GROUP BY event
ORDER BY event
LIMIT 100
```

## Done Criteria

- Landing first-load JavaScript is materially smaller and measured.
- Public render does not mount app-only providers.
- Landing ticker does not run live open-stats aggregation.
- The above-the-fold landing page works with JavaScript disabled except for interactive copy behavior.
- The primary and final CTAs use the same signup destination and canonical command.
- PostHog still captures consented public pageviews and landing CTA/copy events after the provider split.

## Stop Conditions

- Stop if moving providers changes auth session behavior on app routes.
- Stop if snapshot-first stats make public numbers stale beyond the documented freshness policy.
- Stop if WebGL deferral causes visible layout shift above the fold.
