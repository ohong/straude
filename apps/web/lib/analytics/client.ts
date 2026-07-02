"use client";

import posthog from "posthog-js";
import {
  type ActivationEventName,
  type ActivationEventProperties,
  sanitizeActivationProperties,
} from "@/lib/analytics/activation";
import { getCookieConsentFromCookieString } from "@/lib/cookie-consent";

export function trackActivationEvent(
  event: ActivationEventName,
  properties: ActivationEventProperties = {},
): void {
  const sanitized = sanitizeActivationProperties({
    source: "browser",
    ...properties,
  });

  fetch("/api/analytics/activation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties: sanitized }),
    keepalive: true,
  }).catch(() => {});

  if (getCookieConsentFromCookieString(document.cookie)?.analytics) {
    try {
      posthog.capture(event, sanitized);
    } catch {
      // Browser analytics is best-effort; server lifecycle capture is primary.
    }
  }
}
