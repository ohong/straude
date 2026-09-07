// Safe public fields only — never expose email, private settings, etc.
export const PUBLIC_USER_FIELDS = "id, username, display_name, bio, avatar_url, is_public";

function quoteIlikePattern(value: string): string {
  const pattern = `%${value.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const escapedValue = pattern.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escapedValue}"`;
}

export function buildUserSearchFilter(q: string):
  | { ok: true; filter: string }
  | { ok: false; error: string } {
  if (q.length < 2 || q.length > 64) {
    return { ok: false, error: "Query must be between 2 and 64 characters" };
  }
  const normalizedQuery = q.normalize("NFKC").trim();
  if (normalizedQuery.includes("*")) {
    return { ok: false, error: "Query contains unsupported characters" };
  }
  const searchableCharacters = normalizedQuery.match(/[\p{L}\p{N}_-]/gu)?.length ?? 0;
  if (searchableCharacters < 2) {
    return { ok: false, error: "Query must contain at least 2 searchable characters" };
  }
  const pattern = quoteIlikePattern(normalizedQuery);
  return {
    ok: true,
    filter: `username.ilike.${pattern},display_name.ilike.${pattern},github_username.ilike.${pattern}`,
  };
}
