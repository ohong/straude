<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the `straude` CLI (`packages/cli`). A new PostHog client module was created at `packages/cli/src/lib/posthog.ts` that initialises with immediate-flush settings (`flushAt: 1`, `flushInterval: 0`) appropriate for short-lived CLI processes. Five events are now tracked across the login, push, and auto-push flows. User identification is performed on successful login. Exception autocapture is enabled, and critical errors (push failures) are captured explicitly with `captureException`. The client shuts down cleanly at the end of every run via the `.finally()` handler in `index.ts`.

| Event | Description | File |
|---|---|---|
| `login_completed` | User successfully authenticated via the browser OAuth flow | `packages/cli/src/commands/login.ts` |
| `usage_pushed` | User successfully submitted Claude/Codex usage data to the API | `packages/cli/src/commands/push.ts` |
| `usage_push_failed` | Usage submission to the API failed (also captured as an exception) | `packages/cli/src/commands/push.ts` |
| `auto_push_enabled` | User enabled automatic daily push (scheduler or hooks mechanism) | `packages/cli/src/commands/auto.ts` |
| `auto_push_disabled` | User disabled automatic daily push | `packages/cli/src/commands/auto.ts` |

## Next steps

We've built some insights and a dashboard to keep an eye on user behaviour, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/374497/dashboard/1445644
- **Daily pushes & logins** (trend): https://us.posthog.com/project/374497/insights/2kl5yBIF
- **Onboarding funnel: login → push → auto-push**: https://us.posthog.com/project/374497/insights/rJx0mMwz
- **Auto-push adoption vs churn** (weekly): https://us.posthog.com/project/374497/insights/yfRIHC14
- **Push failures (error rate)**: https://us.posthog.com/project/374497/insights/Ja9wMRao
- **New vs returning users (login)**: https://us.posthog.com/project/374497/insights/YsIxTGpc

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
