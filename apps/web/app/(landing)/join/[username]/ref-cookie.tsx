"use client";

import { useEffect } from "react";
import {
  COOKIE_CONSENT_EVENT,
  getCookieConsentFromCookieString,
} from "@/lib/cookie-consent";

export function RefCookie({ username }: { username: string }) {
  useEffect(() => {
    function setRefCookie() {
      document.cookie = `ref=${encodeURIComponent(username)}; path=/; max-age=${
        30 * 24 * 60 * 60
      }; samesite=lax`;
    }

    if (getCookieConsentFromCookieString(document.cookie)) {
      setRefCookie();
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, setRefCookie);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, setRefCookie);
  }, [username]);

  return null;
}
