/**
 * Mention parsing and formatting utilities.
 *
 * - parseMentions: extract unique @usernames from text
 * - getMentionQuery: get the partial @query at cursor for autocomplete
 * - mentionsToMarkdownLinks: convert @user to [@user](/u/user) for markdown rendering
 */

// Match @username preceded by start-of-string or any non-word character.
// This allows (@user), "@user", etc. while still excluding email-like user@name.
const MENTION_RE = /(?:^|(?<=[^a-zA-Z0-9_-]))@([a-zA-Z0-9_-]{1,39})\b/g;

/** Extract unique lowercase usernames from text. */
export function parseMentions(text: string): string[] {
  const matches = text.matchAll(MENTION_RE);
  const usernames = new Set<string>();
  for (const m of matches) {
    usernames.add(m[1].toLowerCase());
  }
  return Array.from(usernames);
}

/** Get partial @query at cursor position, or null if not in a mention. */
export function getMentionQuery(
  text: string,
  cursorPos: number,
): string | null {
  // Walk backwards from cursor to find @
  const before = text.slice(0, cursorPos);
  const match = before.match(/(?:^|[^a-zA-Z0-9_-])@([a-zA-Z0-9_-]{0,39})$/);
  if (!match) return null;
  return match[1].toLowerCase();
}

/** Replace @user with [@user](/u/user) markdown links. */
export function mentionsToMarkdownLinks(text: string): string {
  return text.replace(MENTION_RE, (full, username: string) => {
    return `[@${username}](/u/${username.toLowerCase()})`;
  });
}
