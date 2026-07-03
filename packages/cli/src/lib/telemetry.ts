import { performance } from "node:perf_hooks";
import type { StraudeConfig } from "./auth.js";
import { getDistinctId } from "./machine-id.js";
import { posthog } from "./posthog.js";

type TelemetryProperties = Record<string, string | number | boolean | string[] | null | undefined>;

export const TELEMETRY_SHUTDOWN_TIMEOUT_MS = 150;

export function isPushInvocation(command: string | null): boolean {
  return command === null || command === "push";
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  return typeof error;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function reportUsagePushFailed(
  config: StraudeConfig | null,
  error: unknown,
  properties: TelemetryProperties = {},
): void {
  posthog.capture({
    distinctId: getDistinctId(config),
    event: "usage_push_failed",
    properties: {
      error: truncate(errorMessage(error), 200),
      error_name: errorName(error),
      ...properties,
    },
  });
}

export function reportCliException(
  config: StraudeConfig | null,
  error: unknown,
  properties: TelemetryProperties = {},
): void {
  posthog.captureException(error, getDistinctId(config), properties);
}

export async function shutdownTelemetryWithTimeout(
  timeoutMs = TELEMETRY_SHUTDOWN_TIMEOUT_MS,
): Promise<number> {
  const startedAt = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      posthog._shutdown(timeoutMs),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return Math.round(performance.now() - startedAt);
}
