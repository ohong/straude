"use client";

import {
  type ActivationEventName,
  type ActivationEventProperties,
  sanitizeActivationProperties,
} from "@/lib/analytics/activation";
import { getCookieConsentFromCookieString } from "@/lib/cookie-consent";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();

declare global {
  interface Window {
    __straudePostHogInitialized?: boolean;
  }
}

type PostHogClient = typeof import("posthog-js").default;

let posthogPromise: Promise<PostHogClient | null> | null = null;

export function hasAnalyticsConsent() {
  if (typeof document === "undefined") return false;
  try {
    return getCookieConsentFromCookieString(document.cookie)?.analytics === true;
  } catch {
    return false;
  }
}

/** Share initialization so lazy captures and the provider cannot reinitialize SDK state. */
export function initializeConsentedPostHog(posthog: PostHogClient): boolean {
  if (!POSTHOG_KEY || !hasAnalyticsConsent()) return false;

  if (!window.__straudePostHogInitialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2025-05-24",
      capture_pageview: false,
      capture_performance: { web_vitals: true },
      person_profiles: "identified_only",
      opt_out_persistence_by_default: true,
      // Avoid retaining a batch that could flush after consent is withdrawn.
      request_batching: false,
      before_send: (event) => hasAnalyticsConsent() ? event : null,
    });
    window.__straudePostHogInitialized = true;
  }
  if (posthog.has_opted_out_capturing()) {
    posthog.opt_in_capturing({ captureEventName: false });
  }
  return true;
}

function getPostHogClient(): Promise<PostHogClient | null> {
  if (!POSTHOG_KEY) return Promise.resolve(null);

  posthogPromise ??= import("posthog-js")
    .then((mod) => mod.default)
    .catch(() => null);

  return posthogPromise.then((posthog) =>
    posthog && initializeConsentedPostHog(posthog) ? posthog : null,
  );
}

export async function captureConsentedPostHogEvent(
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  if (!hasAnalyticsConsent()) return;

  const posthog = await getPostHogClient();
  if (hasAnalyticsConsent()) posthog?.capture(event, properties);
}

export function trackActivationEvent(
  event: ActivationEventName,
  properties: ActivationEventProperties = {},
): void {
  if (!hasAnalyticsConsent()) return;
  const sanitized = sanitizeActivationProperties({
    source: "browser",
    ...properties,
    has_analytics_consent: true,
  });

  fetch("/api/analytics/activation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties: sanitized }),
    keepalive: true,
  }).catch(() => {});

  // Activation funnel events are captured exclusively server-side.
}
