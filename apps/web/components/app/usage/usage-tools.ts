import { LEGACY_TOOL } from "@/lib/usage-view";

const TOOL_LABELS: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  pi: "Pi",
  grok: "Grok",
  opencode: "OpenCode",
  antigravity: "Antigravity",
  copilot: "Copilot",
  droid: "Droid",
  kimi: "Kimi",
  hermes: "Hermes",
  openclaw: "OpenClaw",
  omo: "OmO",
  [LEGACY_TOOL]: "Earlier syncs",
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

export function inkColor(percent: number): string {
  return `color-mix(in oklab, var(--color-foreground) ${percent}%, var(--color-background))`;
}

const FALLBACK_COLORS = [
  "var(--color-secondary-blue)",
  inkColor(55),
  "color-mix(in oklab, var(--color-secondary-blue) 55%, var(--color-foreground))",
  inkColor(38),
  inkColor(70),
];

/** Colours keyed off the all-time ranking so a tool keeps its colour across windows and metrics. */
export function toolColors(rankedTools: readonly string[]): Record<string, string> {
  const colors: Record<string, string> = {};
  let fallbackIndex = 0;
  for (const tool of rankedTools) {
    if (tool === "claude") {
      colors[tool] = "var(--color-accent)";
    } else if (tool === "codex") {
      colors[tool] = "var(--color-foreground)";
    } else if (tool === LEGACY_TOOL) {
      colors[tool] = inkColor(45);
    } else {
      colors[tool] = FALLBACK_COLORS[fallbackIndex++ % FALLBACK_COLORS.length];
    }
  }
  return colors;
}
