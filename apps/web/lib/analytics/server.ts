import {
  type ActivationEventName,
  type ActivationEventProperties,
  sanitizeActivationProperties,
} from "@/lib/analytics/activation";
import { getCookieConsentFromCookieString } from "@/lib/cookie-consent";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const SERVER_LIB = "straude-web-server";

interface CaptureInput {
  analyticsConsent?: boolean;
  event: ActivationEventName;
  distinctId: string;
  properties?: ActivationEventProperties | Record<string, unknown>;
}

interface IdentifyInput {
  analyticsConsent?: boolean;
  distinctId: string;
  anonymousDistinctId: string;
  properties?: Record<string, unknown>;
}

/** Browser consent is request-local; CLI telemetry has its own policy. */
export function hasServerAnalyticsConsent(request: Request): boolean {
  try {
    return getCookieConsentFromCookieString(request.headers.get("cookie") ?? "")?.analytics === true;
  } catch {
    return false;
  }
}

function getPostHogConfig() {
  const apiKey = process.env.POSTHOG_API_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host = (process.env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");
  return apiKey ? { apiKey, host } : null;
}

async function postToPostHog(body: Record<string, unknown>): Promise<boolean> {
  const config = getPostHogConfig();
  if (!config) {
    console.error("[posthog] server capture skipped: project key is not configured");
    return false;
  }

  try {
    const response = await fetch(`${config.host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        ...body,
      }),
    });
    if (!response.ok) {
      // Provider responses can echo submitted data; only log the status.
      console.error(`[posthog] server capture rejected: HTTP ${response.status}`);
    }
    return response.ok;
  } catch {
    console.error("[posthog] server capture failed: network request did not complete");
    return false;
  }
}

export async function captureServerActivationEvent(input: CaptureInput): Promise<boolean> {
  if (input.analyticsConsent !== true) return false;
  const properties = sanitizeActivationProperties({
    source: "server",
    ...(input.properties ?? {}),
    has_analytics_consent: true,
  });

  return postToPostHog({
    event: input.event,
    distinct_id: input.distinctId,
    properties: { ...properties, "$lib": SERVER_LIB },
  });
}

export async function identifyServerActivationUser(input: IdentifyInput): Promise<boolean> {
  if (input.analyticsConsent !== true) return false;
  const properties = sanitizeActivationProperties(input.properties);
  return postToPostHog({
    event: "$identify",
    distinct_id: input.distinctId,
    properties: {
      ...properties,
      has_analytics_consent: true,
      "$insert_id": `identify:${input.distinctId}:${input.anonymousDistinctId}`,
      "$anon_distinct_id": input.anonymousDistinctId,
      "$lib": SERVER_LIB,
    },
  });
}
