export const ACTIVATION_ANONYMOUS_COOKIE = "straude_activation_id";
export const ACTIVATION_ANONYMOUS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const ACTIVATION_EVENTS = [
  "landing_primary_cta_clicked",
  "guest_signup_cta_clicked",
  "signup_started",
  "signup_completed",
  "onboarding_profile_started",
  "sync_command_copied",
  "first_sync_nudge_clicked",
  "usage_submit_succeeded",
  "first_sync_confirmed",
  "activation_completed",
] as const;

export type ActivationEventName = (typeof ACTIVATION_EVENTS)[number];

export type ActivationState =
  | "anonymous"
  | "signed_up"
  | "profile_started"
  | "sync_command_copied"
  | "first_usage_submitted"
  | "activated";

export type ActivationSurface =
  | "landing"
  | "signup"
  | "auth_callback"
  | "onboarding"
  | "usage_submit"
  | "usage_status"
  | "feed"
  | "profile"
  | "empty_state"
  | "cli";

export interface ActivationStateInput {
  isAuthenticated: boolean;
  profileStarted?: boolean;
  syncCommandCopied?: boolean;
  usageSubmitted?: boolean;
  webSyncConfirmed?: boolean;
}

export type ActivationEventProperties = Partial<{
  source: "server" | "browser" | "cli" | "web";
  surface: ActivationSurface;
  activation_state: ActivationState;
  is_authenticated: boolean;
  signup_method: "magic_link" | "github";
  cta_location: string;
  destination: string;
  command: string;
  days_pushed: number;
  dates_created: number;
  dates_updated: number;
  result_count: number;
  session_count: number;
  total_tokens: number;
  total_cost_usd: number;
  pricing_mode: string;
  ccusage_version: string;
  ccusage_agents: string[];
  has_analytics_consent: boolean;
  has_existing_usage: boolean;
  has_errors: boolean;
  "$insert_id": string;
}>;

const EVENT_SET = new Set<ActivationEventName>(ACTIVATION_EVENTS);

const ALLOWED_PROPERTY_KEYS = new Set([
  "source",
  "surface",
  "activation_state",
  "is_authenticated",
  "signup_method",
  "cta_location",
  "destination",
  "command",
  "days_pushed",
  "dates_created",
  "dates_updated",
  "result_count",
  "session_count",
  "total_tokens",
  "total_cost_usd",
  "pricing_mode",
  "ccusage_version",
  "ccusage_agents",
  "has_analytics_consent",
  "has_existing_usage",
  "has_errors",
  "$insert_id",
]);

export function isActivationEventName(value: unknown): value is ActivationEventName {
  return typeof value === "string" && EVENT_SET.has(value as ActivationEventName);
}

export function deriveActivationState(input: ActivationStateInput): ActivationState {
  if (!input.isAuthenticated) return "anonymous";
  if (input.webSyncConfirmed) return "activated";
  if (input.usageSubmitted) return "first_usage_submitted";
  if (input.syncCommandCopied) return "sync_command_copied";
  if (input.profileStarted) return "profile_started";
  return "signed_up";
}

export function sanitizeActivationProperties(
  properties: Record<string, unknown> | null | undefined,
): ActivationEventProperties {
  const sanitized: Record<string, unknown> = {};
  if (!properties) return sanitized;

  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      sanitized[key] = value.slice(0, 8);
    }
  }

  return sanitized;
}
