export function prettifyModel(model: string): string {
  const normalized = model.trim();
  if (/claude-fable/i.test(normalized)) return "Claude Fable";
  if (/claude-opus/i.test(normalized)) return "Claude Opus";
  if (/claude-sonnet/i.test(normalized)) return "Claude Sonnet";
  if (/claude-haiku/i.test(normalized)) return "Claude Haiku";

  // Preserve full OpenAI model names (e.g. gpt-5.3-codex -> GPT-5.3-Codex)
  if (/^gpt-/i.test(normalized)) {
    return normalized
      .replace(/^gpt/i, "GPT")
      .replace(/-codex$/i, "-Codex");
  }

  if (/^o4/i.test(normalized)) return "o4";
  if (/^o3/i.test(normalized)) return "o3";
  // Legacy: broader Claude matching (preserves behavior of ActivityCard,
  // open-stats, and CLI's prior local copies).
  if (normalized.includes("fable")) return "Claude Fable";
  if (normalized.includes("opus")) return "Claude Opus";
  if (normalized.includes("sonnet")) return "Claude Sonnet";
  if (normalized.includes("haiku")) return "Claude Haiku";
  return normalized;
}

export function getShareModelLabel(
  models: string[] | null | undefined
): string | null {
  if (!models || models.length === 0) return null;
  if (models.some((model) => /claude-fable/i.test(model))) return "Claude Fable";
  if (models.some((model) => /claude-opus/i.test(model))) return "Claude Opus";
  if (models.some((model) => /claude-sonnet/i.test(model))) {
    return "Claude Sonnet";
  }
  if (models.some((model) => /claude-haiku/i.test(model))) return "Claude Haiku";
  return prettifyModel(models[0]!);
}
