---
summary: Durable project context for Straude's production product, frontend surface, and backend operating assumptions
last_updated: "2026-03-16 12:59 PDT"
read_when:
  - calibrating audit severity
  - making product or architecture tradeoffs
  - resuming work that previously referenced root project guidance
---

# Project Context

## Product

- Straude is a production app with real users.
- Treat outages, broken core flows, and data mistakes as meaningful product incidents rather than low-stakes prototype issues.
- The product includes a public web surface plus authenticated app flows and a CLI integration.

## Backend Context

- Deployment posture: production system with real users.
- Tenancy model: single-tenant.
- Compliance posture: no special regulatory or contractual compliance requirements beyond normal security and privacy best practices.
- Compatibility posture: backward compatibility is not a hard requirement for public APIs or CLI behavior. Favor shipping cleaner behavior over preserving legacy contracts when a tradeoff is necessary.

## Frontend Context

- Surface: one Next.js web app serves both public marketing/shareable pages and authenticated product flows.
- Support target: all modern browsers on desktop and mobile devices.
- SEO matters only for public pages and shareable/public surfaces, not for authenticated app interiors.
- Localization is not currently in scope.
- Accessibility assumption: no formal compliance target is documented yet; continue to build with solid modern accessibility practices unless stricter requirements are added later.
- Auth expectation: public landing, feed, leaderboard, public profiles, referral pages, and public recap shares may be browsed without login; personal settings, posting, messaging, notifications, onboarding, and personal recap flows are authenticated.
- Analytics: Vercel Analytics is installed at the app root, so core public and product journeys should remain instrumented unless intentionally changed.
