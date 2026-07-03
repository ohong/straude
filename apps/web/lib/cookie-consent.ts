export const COOKIE_CONSENT_COOKIE = "straude_cookie_consent";
export const COOKIE_CONSENT_EVENT = "straude:cookie-consent";
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

const COOKIE_CONSENT_VERSION = "v1";

export type CookieConsentPreference = "essential" | "all";

export type CookieConsentState = {
  preference: CookieConsentPreference;
  analytics: boolean;
};

export type CookieConsentEventDetail = CookieConsentState;

export function serializeCookieConsent(preference: CookieConsentPreference) {
  return `${COOKIE_CONSENT_VERSION}-${preference}`;
}

export function parseCookieConsent(
  value: string | null | undefined,
): CookieConsentState | null {
  if (!value) return null;

  const decoded = decodeURIComponent(value);
  if (decoded === serializeCookieConsent("essential")) {
    return { preference: "essential", analytics: false };
  }

  if (decoded === serializeCookieConsent("all")) {
    return { preference: "all", analytics: true };
  }

  return null;
}

export function getCookieConsentFromCookieString(cookieString: string) {
  const target = `${COOKIE_CONSENT_COOKIE}=`;
  const entry = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target));

  if (!entry) return null;
  return parseCookieConsent(entry.slice(target.length));
}
