# Straude Project Guidance

## Project Context

- Straude is a production app with real users. Treat outages, broken core flows, and data mistakes as meaningful product incidents rather than low-stakes prototype issues.
- The product includes a public web surface plus authenticated app flows and a CLI integration.

## Backend Context

- Deployment posture: production system with real users.
- Tenancy model: single-tenant.
- Compliance posture: no special regulatory or contractual compliance requirements beyond normal security and privacy best practices.
- Compatibility posture: backward compatibility is not a hard requirement for public APIs or CLI behavior. Favor shipping cleaner behavior over preserving legacy contracts when a tradeoff is necessary.

## Frontend Context

- Surface: One Next.js web app serves both public marketing/shareable pages and authenticated product flows.
- Support target: all modern browsers on desktop and mobile devices.
- SEO matters only for public pages and shareable/public surfaces, not for authenticated app interiors.
- Localization is not currently in scope.
- Accessibility assumption: no formal compliance target is documented yet; continue to build with solid modern accessibility practices unless stricter requirements are added later.
- Auth expectation: Public landing, feed, leaderboard, public profiles, referral pages, and public recap shares may be browsed without login; personal settings, posting, messaging, notifications, onboarding, and personal recap flows are authenticated.
- Analytics: Vercel Analytics is installed at the app root, so core public and product journeys should remain instrumented unless intentionally changed.

<!-- waypoint:start -->
# Waypoint

This repository uses Waypoint as its Codex operating system.

Waypoint owns only the text inside these `waypoint:start/end` markers.
If you need repo-specific AGENTS instructions, write them outside this managed block.
Do not put durable repo guidance inside the managed block, because `waypoint init` may replace it during upgrades.

Stop here if the bootstrap has not been run yet.

Run the Waypoint bootstrap only in these cases:
- at the start of a new session
- immediately after a compaction
- if the user explicitly tells you to rerun it

Bootstrap sequence:
1. Run `node .waypoint/scripts/prepare-context.mjs`
2. Read `.waypoint/SOUL.md`
3. Read `.waypoint/agent-operating-manual.md`
4. Read `.waypoint/WORKSPACE.md`
5. Read `.waypoint/context/MANIFEST.md`
6. Read every file listed in the manifest

This is mandatory, not optional.

- Do not skip it at session start or after compaction.
- Do not rerun it mid-conversation just because a task is substantial.
- Earlier chat context or earlier work in the session does not replace the bootstrap when a new session starts or a compaction happens.
- If you are not sure whether a new session started or a compaction happened, rerun it.
- Do not skip the context refresh or skip files in the manifest.

Before making meaningful implementation, review, architectural, or tradeoff decisions, inspect the project root guidance files for persisted project context.

Project guidance rules:
- Prefer `AGENTS.md` in the project root if present.
- Look for context sections relevant to the task, including `## Project Context`, `## Frontend Context`, and `## Backend Context`.
- Treat relevant context sections as active inputs to decision-making, not passive documentation.
- Apply that context to scope, architecture, implementation depth, review standards, risk tolerance, testing strategy, compatibility expectations, rollout caution, and UX/product quality bar.

Examples of durable context that can materially change the correct approach:
- internal tool vs public internet-facing product
- expected scale, criticality, and usage patterns
- regulatory, privacy, or compliance requirements
- browser and device support expectations
- accessibility expectations
- SEO requirements
- tenant model and authorization model
- backward compatibility requirements
- reliability and observability expectations
- security posture assumptions

If relevant context is missing, empty, stale, or insufficient and that gap would materially change the correct approach:
- do not guess silently
- use `frontend-context-interview` when project-level frontend context is missing
- use `backend-context-interview` when project-level backend context is missing
- ask only the missing high-leverage questions
- ask about the project, deployment reality, and operating constraints rather than the concrete feature
- persist only durable context back into the project guidance file
- do not write transient task-specific details into context sections

If some uncertainty still remains after checking persisted context and interviewing:
- proceed with explicit assumptions
- state those assumptions clearly in the work output or review
- do not present guesses as established project context

Prefer existing persisted context over re-interviewing the user.

If the user approves a plan or explicitly tells you to proceed, treat that as authorization to execute the work end to end. Do not stop mid-implementation for incremental permission unless a real blocker, hidden-risk decision, or explicit user redirect requires a pause.
When work is in flight elsewhere — reviewer agents, subagents, CI, automated review, external jobs, or other waiting periods — wait as long as required. There is no fixed waiting limit, and slowness alone is not a reason to interrupt or abandon the work.

Working rules:
- Keep `.waypoint/WORKSPACE.md` current as the live execution state, with timestamped new or materially revised entries in multi-topic sections
- For large multi-step work, create or update `.waypoint/track/<slug>.md`, keep detailed execution state there, and point to it from `## Active Trackers` in `.waypoint/WORKSPACE.md`
- Update `.waypoint/docs/` when behavior or durable project knowledge changes, and refresh `last_updated` on touched routable docs
- Use the repo-local skills Waypoint ships for structured workflows when relevant
- Use `work-tracker` when a long-running implementation, remediation, or verification campaign needs durable progress tracking
- Use `docs-sync` when the docs may be stale or a change altered shipped behavior, contracts, routes, or commands
- Use `code-guide-audit` for a targeted coding-guide compliance pass on a specific feature, file set, or change slice
- Use `conversation-retrospective` after major completed work pieces to preserve durable learnings, capture user feedback and errors, improve any skills that were exercised, and record real new-skill candidates
- Do not invoke `break-it-qa`, `frontend-ship-audit`, or `backend-ship-audit` yourself from the managed AGENTS block workflow; they are user-facing skills for explicit human-requested QA or ship-readiness audits, not default agent steps
- Before presenting a non-trivial implementation plan to the user, run `plan-reviewer` and iterate on the plan until it has no meaningful review findings left
- Before considering a non-trivial implementation slice complete, run `code-reviewer`; use a recent self-authored commit as the default scope anchor when one cleanly represents that slice
- Before considering medium or large changes complete, run `code-health-reviewer`, especially when they add structure, duplicate logic, or introduce new abstractions
- Before pushing or opening/updating a PR for substantial work, use `pre-pr-hygiene`
- Use `pr-review` once a PR has active review comments or automated review in progress
- Treat the generated context bundle as required session bootstrap, not optional reference material
- After plan approval, own the execution through implementation, verification, review, and repo-memory updates before surfacing a final completion report
<!-- waypoint:end -->
