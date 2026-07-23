# Client bundle baseline

Captured on 2026-07-18 with Next.js 16.2.6 and
`@next/bundle-analyzer` 16.2.6.

## Reproduce

```bash
bun --cwd apps/web run analyze
```

The command sets `ANALYZE=1`, runs the webpack production build required by
`@next/bundle-analyzer`, and writes gitignored JSON reports to
`apps/web/.next/analyze/`. The normal `bun run build` remains on Turbopack.

The table reports gzip bytes for the union of each page entrypoint, the root
App Router entrypoint, and the authenticated app layout entrypoint. This is an
approximation of route first-load JavaScript from the analyzer graph, with
shared assets deduplicated.

| Authenticated route | Before M6 | After M6 | Delta |
|---|---:|---:|---:|
| `/feed` | 360.7 KiB | 321.6 KiB | -39.1 KiB |
| `/leaderboard` | 369.7 KiB | 330.6 KiB | -39.1 KiB |
| `/u/[username]` | 434.1 KiB | 395.0 KiB | -39.1 KiB |
| `/post/[id]` | 391.5 KiB | 352.5 KiB | -39.1 KiB |
| `/notifications` | 342.3 KiB | 303.2 KiB | -39.1 KiB |
| `/messages` | 348.8 KiB | 309.8 KiB | -39.1 KiB |
| `/prompts` | 339.5 KiB | 300.4 KiB | -39.1 KiB |
| `/recap` | 343.9 KiB | 304.8 KiB | -39.0 KiB |
| `/settings` | 350.8 KiB | 311.5 KiB | -39.2 KiB |
| `/search` | 342.0 KiB | 302.9 KiB | -39.1 KiB |

## Findings and decisions

- `agentation` was the largest avoidable initial module at 40.9 KiB gzip. A
  static import put the development-only toolbar into every production route
  despite the render-time `NODE_ENV` guard. It now sits behind a dynamic client
  boundary: zero Agentation assets are initial, and its chunk is requested only
  when the development toolbar renders.
- The 329.7 KiB gzip `heic2any` chunk is the largest generated client asset, but
  it is already dynamically imported only after native decoding fails for a
  user-selected HEIC/HEIF upload. Keeping it lazy preserves upload support
  without charging initial routes for its WASM bundle.
- Other heavy route-specific dependencies were already split correctly:
  `react-markdown` is a lazy 32.8 KiB gzip chunk, the command palette/kbar path
  is lazy (about 19.2 KiB across two chunks), and the prompt submission modal
  is lazy (2.8 KiB).
- PostHog remains the largest product-owned shared integration at about 63.2
  KiB gzip. It is consent-aware and shared across the authenticated app, so M6
  does not change its initialization contract. Further reduction would require
  a separate analytics-loading decision and production RUM validation.
- Moving settings, search, card, and the initial weekly recap read to the server
  removes client fetch-on-mount waterfalls. Their JavaScript deltas are small by
  design; the primary gain is useful HTML on the first response. The authenticated
  recap harness improved from 552ms LCP to 296ms while preserving period and
  background interactions.

The analyzer emits an existing webpack warning from server-side
`heic-convert`/`libheif-js` in the upload route. Both the analyzer build and the
normal Turbopack production build complete successfully.
