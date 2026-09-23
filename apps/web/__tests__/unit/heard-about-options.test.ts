import { describe, expect, it } from "vitest";
import {
  HEARD_ABOUT_OPTION_KEYS,
  isHeardAboutOptionKey,
  normalizeHeardAboutSources,
} from "@/lib/onboarding/heard-about-options";

describe("heard-about options", () => {
  it("keeps catalog order instead of selection order", () => {
    expect(normalizeHeardAboutSources(["github", "reddit"])).toEqual(["reddit", "github"]);
  });

  it("drops duplicate selections", () => {
    expect(normalizeHeardAboutSources(["google", "google", "google"])).toEqual(["google"]);
  });

  it("ignores values outside the catalog", () => {
    expect(normalizeHeardAboutSources(["google", "myspace", 42, null])).toEqual(["google"]);
  });

  it("returns null when nothing selectable was sent", () => {
    expect(normalizeHeardAboutSources([])).toBeNull();
    expect(normalizeHeardAboutSources(["myspace"])).toBeNull();
    expect(normalizeHeardAboutSources("google")).toBeNull();
    expect(normalizeHeardAboutSources(undefined)).toBeNull();
  });

  it("recognizes catalog keys only", () => {
    for (const key of HEARD_ABOUT_OPTION_KEYS) {
      expect(isHeardAboutOptionKey(key)).toBe(true);
    }
    expect(isHeardAboutOptionKey("Twitter")).toBe(false);
  });
});
