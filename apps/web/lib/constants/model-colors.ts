/** Fallback palette for models that don't match a known name pattern. */
export const MODEL_COLOR_FALLBACK_PALETTE = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#8B5CF6",
  "#EC4899",
];

/** Ordered [pattern, color] pairs for known model families. First match wins. */
export const MODEL_COLOR_PATTERNS: [RegExp, string][] = [
  [/Claude Fable/, "#C2410C"],
  [/Claude Opus/, "#DF561F"],
  [/Claude Sonnet/, "#F08A5D"],
  [/Claude Haiku/, "#F7B267"],
  [/GPT-5/, "#2A9D8F"],
  [/GPT-4o/, "#4C78A8"],
  [/^o3/i, "#3B82F6"],
  [/^o4/i, "#6366F1"],
];
