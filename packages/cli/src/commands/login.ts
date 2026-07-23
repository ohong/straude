import { spawn } from "node:child_process";
import { CONFIG_FILE, DEFAULT_API_URL, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "../config.js";
import { updateConfig } from "../lib/auth.js";
import { ApiHttpError, apiRequestNoAuth } from "../lib/api.js";
import { posthog } from "../lib/posthog.js";
import { getDistinctId, getMachineId } from "../lib/machine-id.js";
import { isInteractive } from "../lib/prompt.js";

interface CliInitResponse {
  code: string;
  verify_url: string;
  poll_secret: string;
}

interface CliPollResponse {
  status: "pending" | "completed" | "expired";
  token?: string;
  username?: string;
}

function openBrowser(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // malformed URL — caller already prints it for manual fallback, no spawn needed
    return;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return;
  }

  const platform = process.platform;
  let command: string;
  let args: string[];
  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "rundll32";
    args = ["url.dll,FileProtocolHandler", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    child.on("error", () => {
      // ignore errors — user can open the URL manually
    });
  } catch {
    // ignore errors — user can open the URL manually
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface LoginOptions {
  /** Reject before opening a browser when invoked by a background process. */
  requireInteractive?: boolean;
  /** Useful for remote terminals where the URL must be opened manually. */
  openBrowser?: boolean;
}

export class NonInteractiveLoginError extends Error {
  constructor() {
    super(
      "Authentication requires an interactive terminal. Run `straude login` " +
        "in a terminal before using auto-push or CI.",
    );
    this.name = "NonInteractiveLoginError";
  }
}

export class LoginCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginCommandError";
  }
}

export function assertInteractiveLogin(): void {
  if (!isInteractive()) throw new NonInteractiveLoginError();
}

function pollDelayMs(failures: number, retryAfterMs: number | null): number {
  if (retryAfterMs != null) return Math.min(retryAfterMs, 10_000);
  return Math.min(POLL_INTERVAL_MS * 2 ** Math.min(failures, 3), 10_000);
}

export async function loginCommand(
  apiUrlOverride?: string,
  options: LoginOptions = {},
): Promise<void> {
  if (options.requireInteractive) assertInteractiveLogin();
  const apiUrl = apiUrlOverride ?? DEFAULT_API_URL;

  console.log("Opening browser for authentication...");

  let initRes: CliInitResponse;
  try {
    initRes = await apiRequestNoAuth<CliInitResponse>(apiUrl, "/api/auth/cli/init", {
      method: "POST",
      timeoutMs: 10_000,
      maxRetries: 2,
    });
  } catch (err) {
    throw new LoginCommandError(`Failed to start login: ${(err as Error).message}`);
  }

  const { code, verify_url, poll_secret } = initRes;
  if (!poll_secret) {
    throw new LoginCommandError(
      "Failed to start login: server did not return a poll secret. " +
        "Please update Straude and try again.",
    );
  }

  if (options.openBrowser !== false) openBrowser(verify_url);
  console.log(`\nIf the browser didn't open, visit:\n  ${verify_url}\n`);
  console.log("Confirm in the browser, then keep this terminal open — Straude will continue syncing here.");
  process.stdout.write("Waiting for confirmation...");

  const startTime = Date.now();
  const deadlineAt = startTime + POLL_TIMEOUT_MS;
  let nextDelayMs = POLL_INTERVAL_MS;

  while (Date.now() < deadlineAt) {
    await sleep(Math.min(nextDelayMs, Math.max(0, deadlineAt - Date.now())));
    if (Date.now() >= deadlineAt) break;

    let pollRes: CliPollResponse;
    try {
      pollRes = await apiRequestNoAuth<CliPollResponse>(apiUrl, "/api/auth/cli/poll", {
        method: "POST",
        body: JSON.stringify({ code, poll_secret }),
        timeoutMs: 10_000,
        deadlineAt,
        maxRetries: 0,
      });
      nextDelayMs = POLL_INTERVAL_MS;
    } catch (error) {
      if (error instanceof ApiHttpError && !error.retryable) {
        process.stdout.write(" failed\n\n");
        throw new LoginCommandError(
          `Login failed while waiting for confirmation: ${error.message}`,
        );
      }
      nextDelayMs = pollDelayMs(
        Math.max(1, Math.round(nextDelayMs / POLL_INTERVAL_MS)),
        error instanceof ApiHttpError ? error.retryAfterMs : null,
      );
      continue;
    }

    if (pollRes.status === "completed" && pollRes.token) {
      process.stdout.write(" done\n\n");

      let sameIdentity = false;
      updateConfig((existing) => {
        sameIdentity =
          existing != null &&
          existing.api_url === apiUrl &&
          existing.username === (pollRes.username ?? "");
        if (sameIdentity) {
          return {
            ...existing,
            token: pollRes.token!,
            username: pollRes.username ?? "",
            api_url: apiUrl,
          };
        }
        return {
          token: pollRes.token!,
          username: pollRes.username ?? "",
          api_url: apiUrl,
        };
      });

      const username = pollRes.username ?? "";
      if (username) {
        // Alias the pre-login machine UUID to the username so the user's
        // anonymous CLI events get attributed to their account.
        posthog.alias({ distinctId: username, alias: getMachineId() });
        posthog.identify({ distinctId: username, properties: { username } });
      }
      posthog.capture({
        distinctId: getDistinctId({ username }),
        event: "login_completed",
        properties: { is_new_user: !sameIdentity },
      });

      const displayName = pollRes.username ? `@${pollRes.username}` : "successfully";
      console.log(`Logged in as ${displayName}`);
      console.log(`Token saved to ${CONFIG_FILE}`);
      return;
    }

    if (pollRes.status === "expired") {
      process.stdout.write(" expired\n\n");
      throw new LoginCommandError("Login code expired. Please try again.");
    }

    // Still pending, continue polling
    process.stdout.write(".");
  }

  process.stdout.write(" timed out\n\n");
  throw new LoginCommandError("Login timed out. Please try again.");
}
