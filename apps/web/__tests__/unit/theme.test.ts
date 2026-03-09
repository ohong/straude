import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  getThemeMetaColor,
  normalizeThemePreference,
  resolveTheme,
} from "@/lib/theme";

describe("theme helpers", () => {
  it("normalizes unknown values to system", () => {
    expect(normalizeThemePreference(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(normalizeThemePreference("sepia")).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it("preserves valid theme preferences", () => {
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("system")).toBe("system");
  });

  it("resolves system theme from the OS preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("returns explicit light and dark themes unchanged", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("returns the correct browser chrome color", () => {
    expect(getThemeMetaColor("light")).toBe("#fcfbf7");
    expect(getThemeMetaColor("dark")).toBe("#050505");
  });
});
