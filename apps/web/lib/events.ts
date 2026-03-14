// ============================================
// Straude — Central Event Taxonomy
//
// Single source of truth for all notification types
// and achievement triggers. Import from here instead
// of using raw string literals.
// ============================================

// ---------------------------------------------------------------------------
// Notification types — used when inserting into the `notifications` table
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = {
  FOLLOW: "follow",
  KUDOS: "kudos",
  COMMENT: "comment",
  MENTION: "mention",
  MESSAGE: "message",
  REFERRAL: "referral",
} as const;

/** Union of all notification type values stored in the `notifications` table. */
export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// ---------------------------------------------------------------------------
// Email notification types — subset used for email templates
// ---------------------------------------------------------------------------

export const EMAIL_NOTIFICATION_TYPES = {
  COMMENT: "comment",
  MENTION: "mention",
  POST_MENTION: "post_mention",
} as const;

/** Union of notification types that trigger an email via the email template. */
export type EmailNotificationType =
  (typeof EMAIL_NOTIFICATION_TYPES)[keyof typeof EMAIL_NOTIFICATION_TYPES];

// ---------------------------------------------------------------------------
// Achievement triggers — used when calling checkAndAwardAchievements
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_TRIGGERS = {
  USAGE: "usage",
  KUDOS: "kudos",
  COMMENT: "comment",
  PHOTO: "photo",
  REFERRAL: "referral",
} as const;

/** Union of event names that can trigger an achievement check. */
export type AchievementTrigger =
  (typeof ACHIEVEMENT_TRIGGERS)[keyof typeof ACHIEVEMENT_TRIGGERS];
