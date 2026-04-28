<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog event tracking across the Straude web app. PostHog was already initialised (provider, pageview tracking, user identification, reverse proxy) — this session added 13 new `posthog.capture()` calls across 8 files covering the core engagement, social, sharing, and growth loops. Environment variables were verified and `NEXT_PUBLIC_POSTHOG_HOST` was added to `apps/web/.env.local`.

| Event | Description | File |
|---|---|---|
| `post_saved` | User saves edits to a post | `apps/web/components/app/post/PostEditor.tsx` |
| `post_deleted` | User permanently deletes a post | `apps/web/components/app/post/PostEditor.tsx` |
| `caption_generated` | User generates an AI caption from post images | `apps/web/components/app/post/PostEditor.tsx` |
| `user_followed` | User follows another user | `apps/web/components/app/profile/FollowButton.tsx` |
| `user_unfollowed` | User unfollows another user | `apps/web/components/app/profile/FollowButton.tsx` |
| `post_shared` | User shares a post (method: copy_link, x, native, copy_image, download_png) | `apps/web/components/app/feed/ShareMenu.tsx` |
| `comment_posted` | User posts a comment or reply | `apps/web/components/app/post/CommentThread.tsx` |
| `comment_liked` | User likes or unlikes a comment | `apps/web/components/app/post/CommentThread.tsx` |
| `invite_link_copied` | User copies their invite link from a profile | `apps/web/components/app/profile/InviteButton.tsx` |
| `message_sent` | User successfully sends a direct message | `apps/web/components/app/messages/MessagesInbox.tsx` |
| `profile_saved` | User saves their profile settings | `apps/web/app/(app)/settings/page.tsx` |
| `referral_link_copied` | User copies their referral link from settings | `apps/web/app/(app)/settings/page.tsx` |
| `usage_imported` | User imports usage data via manual JSON paste | `apps/web/app/(app)/settings/import/page.tsx` |

## Next steps

We've built a dashboard and five insights to track user behaviour based on these events:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/374497/dashboard/1521510
- **Post publishing funnel** (post_saved → post_shared conversion): https://us.posthog.com/project/374497/insights/jMFDuLdW
- **Social engagement over time** (comments, likes, follows): https://us.posthog.com/project/374497/insights/8iDJeP9M
- **Share method breakdown** (which channel users share to): https://us.posthog.com/project/374497/insights/bWOO4TMp
- **Viral loop: invites and referrals** (invite_link_copied, referral_link_copied): https://us.posthog.com/project/374497/insights/URcSjAWx
- **Churn signal: message sent vs post deleted**: https://us.posthog.com/project/374497/insights/BuYLHXEr

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-pages-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
