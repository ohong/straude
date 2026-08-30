/** Fallback palette for models that don't match a known name pattern. */
export const MODEL_COLOR_FALLBACK_PALETTE = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#8B5CF6",
  "#EC4899",
] as const;

/** Ordered [pattern, color] pairs for known model families. First match wins,
 *  so a more specific pattern must come before a broader one. Inputs are the
 *  display names produced by `prettifyModel`, not raw model IDs. */
export const MODEL_COLOR_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/Claude Fable/, "#C2410C"],
  [/Claude Opus/, "#DF561F"],
  [/Claude Sonnet/, "#F08A5D"],
  [/Claude Haiku/, "#F7B267"],
  [/GPT-5/, "#2A9D8F"],
  [/GPT-4o/, "#4C78A8"],
  [/^o3/i, "#3B82F6"],
  [/^o4/i, "#6366F1"],
] as const;

/** Stable chip colour for a model display name. Never returns undefined: every
 *  name that misses the known-family patterns still gets a deterministic
 *  palette entry, which matters now that collection accepts every ccusage
 *  source (Gemini, Kimi, DeepSeek, Qwen, …) rather than just Claude/Codex. */
export function modelColor(name: string): string {
  for (const [pattern, color] of MODEL_COLOR_PATTERNS) {
    if (pattern.test(name)) return color;
  }

  const index = hashString(name) % MODEL_COLOR_FALLBACK_PALETTE.length;
  return MODEL_COLOR_FALLBACK_PALETTE[index]!;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  // `|= 0` yields a signed 32-bit int, so the hash is negative about half the
  // time and `hash % length` would index off the front of the palette.
  return Math.abs(hash);
}
