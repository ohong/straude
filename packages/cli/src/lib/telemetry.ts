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

// Error names, messages, and causes are untrusted. Only these fixed labels and
// validated HTTP statuses become readable diagnostics; original stacks stay local.
const ERROR_CATEGORIES = new Map([
  ["ApiHttpError", "api_http"],
  ["SessionExpiredError", "authentication_required"],
  ["ApiTimeoutError", "api_timeout"],
  ["PricingUnavailableError", "pricing_unavailable"],
  ["ConfigCorruptError", "config_corrupt"],
  ["SyncStateCorruptError", "sync_state_corrupt"],
  ["InstallationIdentityError", "installation_identity"],
  ["CliArgumentError", "invalid_arguments"],
  ["NonInteractiveLoginError", "authentication_required"],
  ["LoginCommandError", "login_failed"],
  ["TypeError", "type_error"],
  ["SyntaxError", "syntax_error"],
  ["RangeError", "range_error"],
]);

const SYSTEM_ERROR_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH",
  "EACCES", "EPERM", "ENOENT", "ENOSPC", "EMFILE",
]);

// These prefixes are authored by ccusage.ts, not extracted from collector stderr.
const COLLECTOR_FAILURES = [
  ["ccusage timed out.", "collector_timeout"],
  ["ccusage exceeded the configured local scan deadline.", "collector_timeout"],
  ["ccusage failed:", "collector_execution"],
  ["Failed to parse ccusage output as JSON:", "collector_json"],
  ["Unexpected ccusage output format:", "collector_schema"],
  ["Invalid ccusage row", "collector_schema"],
  ["Invalid ccusage output:", "collector_schema"],
  ["Installed ccusage dependency is missing.", "collector_installation"],
  ["Installed ccusage native binary is missing", "collector_installation"],
  ["ccusage native binary is not available", "collector_platform"],
] as const;

function errorDiagnostics(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const error_name = ERROR_CATEGORIES.has(name) ? name : "Error";
  let error_category = ERROR_CATEGORIES.get(name) ?? "unexpected_error";
  if (error instanceof Error && error_category === "unexpected_error") {
    error_category = COLLECTOR_FAILURES.find(([prefix]) => error.message.startsWith(prefix))?.[1]
      ?? error_category;
  }
  const status = error instanceof Error && "status" in error ? error.status : undefined;
  const http_status = (name === "ApiHttpError" || name === "SessionExpiredError")
    && typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : undefined;
  // Node fetch wraps network errors in TypeError.cause. Keep only known errno
  // codes; arbitrary cause messages and properties must not enter the payload.
  const candidates = error instanceof Error ? [error, error.cause] : [];
  const system_error_code = candidates
    .map((candidate) => candidate instanceof Error && "code" in candidate ? candidate.code : undefined)
    .find((code): code is string => typeof code === "string" && SYSTEM_ERROR_CODES.has(code));
  return {
    error_name,
    error_category,
    ...(http_status === undefined ? {} : { http_status }),
    ...(system_error_code === undefined ? {} : { system_error_code }),
  };
}

function errorFingerprint(error: unknown, diagnostics: ReturnType<typeof errorDiagnostics>): string {
  const stack = error instanceof Error && error.stack
    ? error.stack
      .split("\n")
      .slice(1, 6)
      .map((frame) => frame
        .replaceAll(/file:\/\/\/[^)\s]+[/\\]([^/\\)\s]+:\d+:\d+)/g, "$1")
        .replaceAll(/(?:[A-Za-z]:)?[^()\s]+[/\\]([^/\\)\s]+:\d+:\d+)/g, "$1"))
      .join("\n")
    : "";
  return createHash("sha256").update(`${JSON.stringify(diagnostics)}\n${stack}`).digest("hex").slice(0, 24);
}

export function reportUsagePushFailed(
  config: StraudeConfig | null,
  error: unknown,
  properties: TelemetryProperties = {},
): void {
  const diagnostics = errorDiagnostics(error);
  posthog.capture({
    distinctId: getDistinctId(config),
    event: "usage_push_failed",
    properties: {
      stage: "command",
      ...properties,
      ...diagnostics,
      error_fingerprint: errorFingerprint(error, diagnostics),
    },
  });
}

export function reportCliException(
  config: StraudeConfig | null,
  error: unknown,
  properties: TelemetryProperties = {},
): void {
  const diagnostics = errorDiagnostics(error);
  const fingerprint = errorFingerprint(error, diagnostics);
  // Use a fresh Error so PostHog retains Error Tracking metadata without reading
  // the original message, causes, extra properties, or local source context.
  const sanitized = new Error(diagnostics.error_category);
  sanitized.name = diagnostics.error_name;
  sanitized.stack = `${sanitized.name}: ${sanitized.message}`;
  posthog.captureException(sanitized, getDistinctId(config), {
    stage: "command",
    ...properties,
    ...diagnostics,
    error_fingerprint: fingerprint,
    $exception_fingerprint: `straude:${fingerprint}`,
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
