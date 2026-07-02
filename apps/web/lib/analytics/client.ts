"use client";

import {
  type ActivationEventName,
  type ActivationEventProperties,
  sanitizeActivationProperties,
} from "@/lib/analytics/activation";
import { getCookieConsentFromCookieString } from "@/lib/cookie-consent";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

declare global {
  interface Window {
    __straudePostHogInitialized?: boolean;
  }
}

type PostHogClient = typeof import("posthog-js").default;

let posthogPromise: Promise<PostHogClient | null> | null = null;

function hasAnalyticsConsent() {
  return getCookieConsentFromCookieString(document.cookie)?.analytics ?? false;
}

function getPostHogClient(): Promise<PostHogClient | null> {
  if (!POSTHOG_KEY) return Promise.resolve(null);

  posthogPromise ??= import("posthog-js")
    .then((mod) => {
      const posthog = mod.default;

      if (!window.__straudePostHogInitialized) {
        posthog.init(POSTHOG_KEY, {
          api_host: "/ingest",
          ui_host: "https://us.posthog.com",
          defaults: "2025-05-24",
          capture_pageview: false,
          person_profiles: "identified_only",
        });
        window.__straudePostHogInitialized = true;
      }

      return posthog;
    })
    .catch(() => null);

  return posthogPromise;
}

export async function captureConsentedPostHogEvent(
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  if (!hasAnalyticsConsent()) return;

  const posthog = await getPostHogClient();
  posthog?.capture(event, properties);
}

export function trackActivationEvent(
  event: ActivationEventName,
  properties: ActivationEventProperties = {},
): void {
  const analyticsConsent = hasAnalyticsConsent();
  const sanitized = sanitizeActivationProperties({
    source: "browser",
    has_analytics_consent: analyticsConsent,
    ...properties,
  });

  fetch("/api/analytics/activation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties: sanitized }),
    keepalive: true,
  }).catch(() => {});

  void captureConsentedPostHogEvent(event, sanitized);
}
