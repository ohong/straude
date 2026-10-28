import {
  type ActivationEventName,
  type ActivationEventProperties,
  sanitizeActivationProperties,
} from "@/lib/analytics/activation";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const SERVER_LIB = "straude-web-server";

interface CaptureInput {
  event: ActivationEventName;
  distinctId: string;
  properties?: ActivationEventProperties | Record<string, unknown>;
}

interface IdentifyInput {
  distinctId: string;
  anonymousDistinctId: string;
  properties?: Record<string, unknown>;
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
  const properties = sanitizeActivationProperties({
    source: "server",
    ...(input.properties ?? {}),
    "$lib": SERVER_LIB,
  });

  return postToPostHog({
    event: input.event,
    distinct_id: input.distinctId,
    properties,
  });
}

export async function identifyServerActivationUser(input: IdentifyInput): Promise<boolean> {
  const properties = sanitizeActivationProperties(input.properties);
  return postToPostHog({
    event: "$identify",
    distinct_id: input.distinctId,
    properties: {
      ...properties,
      "$anon_distinct_id": input.anonymousDistinctId,
      "$lib": SERVER_LIB,
    },
  });
}
