import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/cookie-consent/route";
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE,
  serializeCookieConsent,
} from "@/lib/cookie-consent";

function makeRequest(body: unknown) {
  return new NextRequest(new URL("/api/cookie-consent", "http://localhost"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/cookie-consent", () => {
  it("sets an essential-only consent cookie", async () => {
    const response = await POST(makeRequest({ preference: "essential" }));
    const json = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(json).toEqual({ preference: "essential", analytics: false });
    expect(setCookie).toContain(
      `${COOKIE_CONSENT_COOKIE}=${serializeCookieConsent("essential")}`,
    );
    expect(setCookie).toContain(`Max-Age=${COOKIE_CONSENT_MAX_AGE}`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("sets analytics consent when all cookies are accepted", async () => {
    const response = await POST(makeRequest({ preference: "all" }));
    const json = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(json).toEqual({ preference: "all", analytics: true });
    expect(setCookie).toContain(
      `${COOKIE_CONSENT_COOKIE}=${serializeCookieConsent("all")}`,
    );
  });

  it("rejects invalid preferences", async () => {
    const response = await POST(makeRequest({ preference: "marketing" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid cookie preference");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
