"use client";

import { useSyncExternalStore } from "react";
import {
  COOKIE_CONSENT_EVENT,
  type CookieConsentEventDetail,
  getCookieConsentFromCookieString,
} from "@/lib/cookie-consent";

let analyticsConsentOverride: boolean | null = null;

function subscribe(callback: () => void) {
  const handleConsent = (event: Event) => {
    const detail = (event as CustomEvent<CookieConsentEventDetail>).detail;
    if (typeof detail?.analytics === "boolean") {
      analyticsConsentOverride = detail.analytics;
    }
    callback();
  };

  window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
}

function getSnapshot() {
  if (analyticsConsentOverride !== null) return analyticsConsentOverride;
  return getCookieConsentFromCookieString(document.cookie)?.analytics ?? false;
}

function getServerSnapshot() {
  return false;
}

export function useAnalyticsConsent() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
