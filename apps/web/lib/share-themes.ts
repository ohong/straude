export const SHARE_THEMES = [
  {
    id: "light",
    label: "Paper",
    background: "#F6F0E6",
    overlay: undefined,
    textPrimary: "#18181B",
    textSecondary: "#57534E",
    textTertiary: "#78716C",
    accent: "#DF561F",
    surface: "rgba(255,255,255,0.88)",
    surfaceSecondary: "rgba(255,255,255,0.64)",
    surfaceBorder: "rgba(24,24,27,0.08)",
    badgeBackground: "rgba(255,255,255,0.92)",
    badgeBorder: "rgba(24,24,27,0.08)",
    spotlightPrimary: "rgba(223,86,31,0.16)",
    spotlightSecondary: "rgba(245,184,85,0.18)",
  },
  {
    id: "dark",
    label: "Graphite",
    background: "#0A0A0A",
    overlay: undefined,
    textPrimary: "#FFFFFF",
    textSecondary: "#D4D4D8",
    textTertiary: "#A1A1AA",
    accent: "#DF561F",
    surface: "rgba(24,24,27,0.82)",
    surfaceSecondary: "rgba(24,24,27,0.58)",
    surfaceBorder: "rgba(255,255,255,0.10)",
    badgeBackground: "rgba(24,24,27,0.88)",
    badgeBorder: "rgba(255,255,255,0.12)",
    spotlightPrimary: "rgba(223,86,31,0.24)",
    spotlightSecondary: "rgba(251,191,36,0.14)",
  },
  {
    id: "accent",
    label: "Solar",
    background:
      "linear-gradient(135deg, #F7BF5B 0%, #F28F3B 48%, #F7E1B5 100%)",
    overlay: "rgba(255,250,244,0.72)",
    textPrimary: "#1C1917",
    textSecondary: "#57534E",
    textTertiary: "#8A6A55",
    accent: "#C2410C",
    surface: "rgba(255,252,247,0.76)",
    surfaceSecondary: "rgba(255,252,247,0.56)",
    surfaceBorder: "rgba(28,25,23,0.08)",
    badgeBackground: "rgba(255,255,255,0.62)",
    badgeBorder: "rgba(28,25,23,0.08)",
    spotlightPrimary: "rgba(255,255,255,0.26)",
    spotlightSecondary: "rgba(223,86,31,0.18)",
  },
] as const;

export type ShareThemeId = (typeof SHARE_THEMES)[number]["id"];

export const DEFAULT_SHARE_THEME: ShareThemeId = "light";

export function getShareTheme(id: string) {
  return SHARE_THEMES.find((t) => t.id === id) ?? SHARE_THEMES[0];
}
