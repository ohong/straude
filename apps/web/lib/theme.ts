export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";
export const THEME_STORAGE_KEY = "straude-theme";
export const THEME_ATTRIBUTE = "data-theme";
export const THEME_META_COLOR_LIGHT = "#fcfbf7";
export const THEME_META_COLOR_DARK = "#050505";

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function normalizeThemePreference(
  value: string | null | undefined,
): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return preference;
}

export function getThemeMetaColor(theme: ResolvedTheme): string {
  return theme === "dark" ? THEME_META_COLOR_DARK : THEME_META_COLOR_LIGHT;
}

export function getThemeBootstrapScript(): string {
  return `
    (function () {
      var storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
      var attribute = ${JSON.stringify(THEME_ATTRIBUTE)};
      var themeColorLight = ${JSON.stringify(THEME_META_COLOR_LIGHT)};
      var themeColorDark = ${JSON.stringify(THEME_META_COLOR_DARK)};
      var mediaQuery = "(prefers-color-scheme: dark)";

      function normalize(value) {
        return value === "light" || value === "dark" || value === "system"
          ? value
          : "system";
      }

      function readStoredTheme() {
        try {
          return normalize(window.localStorage.getItem(storageKey));
        } catch {
          return "system";
        }
      }

      function resolve(preference) {
        if (preference === "light" || preference === "dark") return preference;
        if (!window.matchMedia) return "light";
        return window.matchMedia(mediaQuery).matches ? "dark" : "light";
      }

      var preference = readStoredTheme();
      var resolved = resolve(preference);
      var root = document.documentElement;
      root.setAttribute(attribute, resolved);
      root.style.colorScheme = resolved;

      var themeColor = resolved === "dark" ? themeColorDark : themeColorLight;
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
        meta.setAttribute("content", themeColor);
      });
    })();
  `;
}
