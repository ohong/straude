import { exec } from "node:child_process";
import { DEFAULT_API_URL, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "../config.js";
import { saveConfig } from "../lib/auth.js";
import { apiRequestNoAuth } from "../lib/api.js";

interface CliInitResponse {
  code: string;
  verify_url: string;
}

interface CliPollResponse {
  status: "pending" | "completed" | "expired";
  token?: string;
  username?: string;
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, () => {
    // ignore errors — user can open the URL manually
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginCommand(): Promise<void> {
  const apiUrl = DEFAULT_API_URL;

  console.log("Opening browser for authentication...");

  let initRes: CliInitResponse;
  try {
    initRes = await apiRequestNoAuth<CliInitResponse>(apiUrl, "/api/auth/cli/init", {
      method: "POST",
    });
  } catch (err) {
    console.error(`Failed to start login: ${(err as Error).message}`);
    process.exit(1);
  }

  const { code, verify_url } = initRes;

  openBrowser(verify_url);
  console.log(`\nIf the browser didn't open, visit:\n  ${verify_url}\n`);
  process.stdout.write("Waiting for confirmation...");

  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    let pollRes: CliPollResponse;
    try {
      pollRes = await apiRequestNoAuth<CliPollResponse>(apiUrl, "/api/auth/cli/poll", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
    } catch {
      // Network errors during polling are transient, keep trying
      continue;
    }

    if (pollRes.status === "completed" && pollRes.token) {
      process.stdout.write(" done\n\n");

      saveConfig({
        token: pollRes.token,
        username: pollRes.username ?? "",
        api_url: apiUrl,
      });

      const displayName = pollRes.username ? `@${pollRes.username}` : "successfully";
      console.log(`Logged in as ${displayName}`);
      console.log(`Token saved to ~/.straude/config.json`);
      return;
    }

    if (pollRes.status === "expired") {
      process.stdout.write(" expired\n\n");
      console.error("Login code expired. Please try again.");
      process.exit(1);
    }

    // Still pending, continue polling
    process.stdout.write(".");
  }

  process.stdout.write(" timed out\n\n");
  console.error("Login timed out. Please try again.");
  process.exit(1);
}
