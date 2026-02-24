export const SHARE_THEMES = [
  {
    id: "light",
    label: "Light",
    background: "#FFFFFF",
    overlay: undefined,
    textPrimary: "#000000",
    textSecondary: "#666666",
    textTertiary: "#999999",
    accent: "#DF561F",
  },
  {
    id: "dark",
    label: "Dark",
    background: "#0A0A0A",
    overlay: undefined,
    textPrimary: "#FFFFFF",
    textSecondary: "#A0A0A0",
    textTertiary: "#666666",
    accent: "#DF561F",
  },
  {
    id: "accent",
    label: "Accent",
    background: "linear-gradient(135deg, #FF8C42 0%, #FFF275 50%, #FF6B6B 100%)",
    overlay: "rgba(255,255,255,0.82)",
    textPrimary: "#000000",
    textSecondary: "#666666",
    textTertiary: "#999999",
    accent: "#DF561F",
  },
] as const;

export type ShareThemeId = (typeof SHARE_THEMES)[number]["id"];

export const DEFAULT_SHARE_THEME: ShareThemeId = "light";

export function getShareTheme(id: string) {
  return SHARE_THEMES.find((t) => t.id === id) ?? SHARE_THEMES[0];
}
