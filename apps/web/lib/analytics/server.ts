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
  const apiKey = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = (process.env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");
  return apiKey ? { apiKey, host } : null;
}

async function postToPostHog(body: Record<string, unknown>): Promise<boolean> {
  const config = getPostHogConfig();
  if (!config) return false;

  try {
    const response = await fetch(`${config.host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        ...body,
      }),
    });
    return response.ok;
  } catch {
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
