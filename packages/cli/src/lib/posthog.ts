import { homedir } from "node:os";
import { PostHog } from "posthog-node";
import type { EventMessage } from "posthog-node";
import { CLI_VERSION } from "../config.js";

// Public PostHog project key (write-only, designed for client-side embedding).
// Same key as the web bundle's NEXT_PUBLIC_POSTHOG_KEY so CLI events and web
// events show up under the same users when a session is identified.
const PUBLIC_KEY = "phc_mTjaDJWefPyBXvVuugNXJVKbzc5MRE8uQ22hZJ8kcfYo";
const PUBLIC_HOST = "https://us.i.posthog.com";

const optedOut =
  truthyEnv(process.env.STRAUDE_TELEMETRY_DISABLED) ||
  truthyEnv(process.env.DO_NOT_TRACK) ||
  // Never send events from test runs.
  Boolean(process.env.VITEST) ||
  process.env.NODE_ENV === "test";

const apiKey =
  process.env.POSTHOG_API_KEY ?? (optedOut ? undefined : PUBLIC_KEY);
const host = process.env.POSTHOG_HOST ?? PUBLIC_HOST;

// No-op stub used when telemetry is disabled
const noop = new Proxy({} as PostHog, {
  get: () => () => Promise.resolve(),
});

const HOME = homedir();
const HOME_RE = HOME ? new RegExp(escapeRegex(HOME), "g") : null;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Recursively replace the user's home directory in any string with `~` so
 * stack traces, error messages, and other free-form payload don't leak the
 * absolute path of the user's machine.
 */
function scrubHome(value: unknown): unknown {
  if (typeof value === "string") {
    return HOME_RE ? value.replace(HOME_RE, "~") : value;
  }
  if (Array.isArray(value)) return value.map(scrubHome);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubHome(v);
    }
    return out;
  }
  return value;
}

function beforeSend(event: EventMessage | null): EventMessage | null {
  if (!event) return event;
  if (event.properties) {
    event.properties = scrubHome(event.properties) as Record<string, unknown>;
  }
  // Stamp every event with the CLI version so we can attribute regressions.
  event.properties = {
    cli_version: CLI_VERSION,
    ...(event.properties ?? {}),
  };
  return event;
}

function truthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

// For short-lived CLI processes: flush immediately after every event
export const posthog: PostHog = apiKey
  ? new PostHog(apiKey, {
      host,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
      before_send: beforeSend,
    })
  : noop;
