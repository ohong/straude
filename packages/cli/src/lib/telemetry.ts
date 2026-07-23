import { createHash } from "node:crypto";
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

function errorFingerprint(error: unknown): string {
  const name = errorName(error);
  const stack = error instanceof Error && error.stack
    ? error.stack
      .split("\n")
      .slice(1, 6)
      .map((frame) => frame
        .replaceAll(/file:\/\/\/[^)\s]+[/\\]([^/\\)\s]+:\d+:\d+)/g, "$1")
        .replaceAll(/(?:[A-Za-z]:)?[^()\s]+[/\\]([^/\\)\s]+:\d+:\d+)/g, "$1"))
      .join("\n")
    : "";
  return createHash("sha256").update(`${name}\n${stack}`).digest("hex").slice(0, 24);
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
      error_name: errorName(error),
      error_fingerprint: errorFingerprint(error),
      ...properties,
    },
  });
}

export function reportCliException(
  config: StraudeConfig | null,
  error: unknown,
  properties: TelemetryProperties = {},
): void {
  posthog.capture({
    distinctId: getDistinctId(config),
    event: "cli_exception",
    properties: {
      error_name: errorName(error),
      error_fingerprint: errorFingerprint(error),
      ...properties,
    },
  });
}

export async function shutdownTelemetryWithTimeout(
  timeoutMs = TELEMETRY_SHUTDOWN_TIMEOUT_MS,
): Promise<number> {
  const startedAt = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    try {
      await Promise.race([
        posthog._shutdown(timeoutMs),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
          timer.unref?.();
        }),
      ]);
    } catch {
      // Telemetry must never change a command's result or exit code.
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
  return Math.round(performance.now() - startedAt);
}
