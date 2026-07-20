# Perf scorecard - 2026-07-18T22:07:05.151Z

Targets: TTFB < 300ms, LCP < 500ms (median of 4 warm runs after discarding run 1, local production build)

| Page | TTFB | FCP | LCP | Server-Timing | Layout attribution | Pass |
|---|---:|---:|---:|---|---|:---:|
| /feed | 39ms | 116ms | 462ms | mw-auth:0ms | layoutAuth:2ms layoutProfile:30ms | PASS |
| /leaderboard | 46ms | 108ms | 476ms | mw-auth:1ms | layoutAuth:3ms layoutProfile:36ms | PASS |
| /u/[username] | 41ms | 104ms | 492ms | mw-auth:1ms | layoutAuth:3ms layoutProfile:31ms | PASS |
| /post/[id] | 41ms | 110ms | 454ms | mw-auth:0ms | layoutAuth:3ms layoutProfile:30ms | PASS |
| /notifications | 35ms | 92ms | 444ms | mw-auth:0ms | layoutAuth:1ms layoutProfile:28ms | PASS |
| /messages | 37ms | 92ms | 444ms | mw-auth:0ms | layoutAuth:1ms layoutProfile:30ms | PASS |
| /prompts | 37ms | 96ms | 96ms | mw-auth:0ms | layoutAuth:2ms layoutProfile:30ms | PASS |
| /recap | 40ms | 112ms | 446ms | mw-auth:0ms | layoutAuth:2ms layoutProfile:33ms | PASS |
| /settings | 45ms | 114ms | 460ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:38ms | PASS |
| /search | 43ms | 110ms | 444ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:33ms | PASS |

Right sidebar API: 29ms

10/10 pages passing
