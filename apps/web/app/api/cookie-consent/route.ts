import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE,
  type CookieConsentPreference,
  serializeCookieConsent,
} from "@/lib/cookie-consent";

const VALID_PREFERENCES = new Set<CookieConsentPreference>([
  "essential",
  "all",
]);

export async function POST(request: NextRequest) {
  let body: { preference?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const preference = body.preference;
  if (typeof preference !== "string" || !VALID_PREFERENCES.has(preference as CookieConsentPreference)) {
    return NextResponse.json({ error: "Invalid cookie preference" }, { status: 400 });
  }

  const typedPreference = preference as CookieConsentPreference;
  const response = NextResponse.json({
    preference: typedPreference,
    analytics: typedPreference === "all",
  });

  response.cookies.set({
    name: COOKIE_CONSENT_COOKIE,
    value: serializeCookieConsent(typedPreference),
    path: "/",
    maxAge: COOKIE_CONSENT_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
