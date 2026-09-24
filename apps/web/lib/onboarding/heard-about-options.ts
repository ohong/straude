/**
 * Acquisition sources offered by the "How did you hear about us?" survey.
 *
 * Keys are stored in `users.heard_about_sources` and grouped by analytics.
 * They are the stable contract: labels may change, keys may not.
 */
export const HEARD_ABOUT_OPTION_KEYS = [
  "google",
  "search_engine",
  "friend_or_coworker",
  "newsletter",
  "hacker_news",
  "reddit",
  "x_twitter",
  "linkedin",
  "youtube",
  "instagram",
  "facebook",
  "github",
  "billboards_outside",
  "podcast",
  "ai_agent",
  "other",
] as const;

export type HeardAboutOptionKey = (typeof HEARD_ABOUT_OPTION_KEYS)[number];

/** Keep the onboarding choice short while retaining older keys for stored answers. */
export const HEARD_ABOUT_SURVEY_KEYS = [
  "search_engine",
  "friend_or_coworker",
  "x_twitter",
  "github",
  "hacker_news",
  "reddit",
  "newsletter",
  "podcast",
  "youtube",
  "ai_agent",
  "other",
] as const satisfies readonly HeardAboutOptionKey[];

export type HeardAboutSurveyKey = (typeof HEARD_ABOUT_SURVEY_KEYS)[number];

export const HEARD_ABOUT_LABELS: Record<HeardAboutOptionKey, string> = {
  google: "Google",
  search_engine: "Search engine",
  friend_or_coworker: "Friend or coworker",
  newsletter: "Newsletter",
  hacker_news: "Hacker News",
  reddit: "Reddit",
  x_twitter: "X / Twitter",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  github: "GitHub",
  billboards_outside: "Billboards / Outside",
  podcast: "Podcast",
  ai_agent: "AI assistant",
  other: "Other",
};

const OPTION_KEY_SET: ReadonlySet<string> = new Set(HEARD_ABOUT_OPTION_KEYS);

export function isHeardAboutOptionKey(value: unknown): value is HeardAboutOptionKey {
  return typeof value === "string" && OPTION_KEY_SET.has(value);
}

/**
 * Normalize a client-supplied selection into stored keys.
 *
 * Keeps catalog order, drops duplicates, and ignores anything unrecognized so
 * a stale client cannot write an unknown value. Returns `null` when the caller
 * sent nothing selectable, which the caller maps to "clear the column".
 */
export function normalizeHeardAboutSources(value: unknown): HeardAboutOptionKey[] | null {
  if (!Array.isArray(value)) return null;

  const selected = new Set(value.filter(isHeardAboutOptionKey));
  if (selected.size === 0) return null;

  return HEARD_ABOUT_OPTION_KEYS.filter((key) => selected.has(key));
}
