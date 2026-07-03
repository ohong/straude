import { describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_COOKIE,
  getCookieConsentFromCookieString,
  parseCookieConsent,
  serializeCookieConsent,
} from "@/lib/cookie-consent";

describe("cookie consent helpers", () => {
  it("serializes and parses essential-only consent", () => {
    const value = serializeCookieConsent("essential");

    expect(parseCookieConsent(value)).toEqual({
      preference: "essential",
      analytics: false,
    });
  });

  it("serializes and parses analytics consent", () => {
    const value = serializeCookieConsent("all");

    expect(parseCookieConsent(value)).toEqual({
      preference: "all",
      analytics: true,
    });
  });

  it("extracts consent from a browser cookie string", () => {
    const value = serializeCookieConsent("essential");

    expect(
      getCookieConsentFromCookieString(
        `theme=dark; ${COOKIE_CONSENT_COOKIE}=${value}; ref=alice`,
      ),
    ).toEqual({
      preference: "essential",
      analytics: false,
    });
  });

  it("ignores unknown consent values", () => {
    expect(parseCookieConsent("v0-all")).toBeNull();
    expect(getCookieConsentFromCookieString("theme=dark")).toBeNull();
  });
});
