import { execFile as execFileCb } from "node:child_process";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../config.js";
import { isBinaryOnPath } from "./binary.js";
import { parseDailyUsageOutput, type CcusageOutput } from "./ccusage.js";

interface ExecError extends Error {
  stderr?: string;
  signal?: string | null;
  killed?: boolean;
}

export const AGENTSVIEW_COLLECTOR = "agentsview-v1" as const;
export const MIN_AGENTSVIEW_VERSION = "0.28.0";

let _resolved: { cmd: string; args: string[] } | undefined;

function resolveAgentsViewCommand(): { cmd: string; args: string[] } {
  if (_resolved) return _resolved;

  if (isBinaryOnPath("agentsview")) {
    _resolved = { cmd: "agentsview", args: [] };
    return _resolved;
  }

  throw new Error(
    "agentsview is not installed or not on PATH. Install it from https://www.agentsview.io/.",
  );
}

export function hasAgentsView(): boolean {
  try {
    resolveAgentsViewCommand();
    return true;
  } catch {
    return false;
  }
}

export function _resetAgentsViewResolver(): void {
  _resolved = undefined;
}

function execAgentsViewAsync(args: string[], timeoutMs?: number): Promise<string> {
  const { cmd, args: prefix } = resolveAgentsViewCommand();
  const cmdArgs = [...prefix, ...args];

  return new Promise((resolve, reject) => {
    execFileCb(cmd, cmdArgs, {
      encoding: "utf-8",
      timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    }, (err, stdout) => {
      if (!err) {
        resolve(stdout);
        return;
      }
      const error = err as ExecError;
      if (error.killed || error.signal === "SIGTERM") {
        reject(new Error(
          "agentsview timed out. Try running `agentsview usage daily --json --offline` directly to verify it works.",
        ));
        return;
      }
      const detail = error.stderr?.trim() || error.message || "unknown error";
      reject(new Error(`agentsview failed: ${detail}`));
    });
  });
}

export function parseAgentsViewVersion(raw: string): string | null {
  // Capture `vX.Y.Z` plus optional `-prerelease` and `+build` suffixes so we
  // tolerate values like `0.28.0-rc.1` or `0.28.0+build.1`. The captured
  // string preserves the suffix; `compareVersions` strips it before comparing.
  const match = raw.match(/\bv?(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?)\b/);
  return match ? match[1]! : null;
}

function compareVersions(a: string, b: string): number {
  // Strip pre-release (`-…`) and build (`+…`) suffixes — we treat a release
  // candidate like `0.28.0-rc.1` as equivalent to `0.28.0` so RCs of a
  // supported version pass the gate. Strict semver would order pre-releases
  // before the final release, but for our gating purposes that's stricter
  // than we want.
  const stripSuffix = (v: string): string => v.split(/[-+]/)[0]!;
  const aParts = stripSuffix(a).split(".").map((part) => Number(part));
  const bParts = stripSuffix(b).split(".").map((part) => Number(part));
  for (let i = 0; i < 3; i++) {
    const delta = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function isSupportedAgentsViewVersion(version: string | null): boolean {
  return version != null && compareVersions(version, MIN_AGENTSVIEW_VERSION) >= 0;
}

export async function getAgentsViewVersion(timeoutMs?: number): Promise<string> {
  const raw = await execAgentsViewAsync(["version"], timeoutMs);
  const version = parseAgentsViewVersion(raw);
  if (!version) {
    throw new Error("Unable to determine agentsview version from `agentsview version` output.");
  }
  return version;
}

export async function isSupportedAgentsViewInstalled(timeoutMs?: number): Promise<boolean> {
  if (!hasAgentsView()) return false;
  try {
    return isSupportedAgentsViewVersion(await getAgentsViewVersion(timeoutMs));
  } catch {
    return false;
  }
}

export async function runAgentsViewRawAsync(
  sinceDate: string,
  untilDate: string,
  timeoutMs?: number,
  options: { timezone?: string; agent?: string; offline?: boolean } = {},
): Promise<string> {
  const args = [
    "usage",
    "daily",
    "--json",
    "--breakdown",
  ];
  if (options.agent) {
    args.push("--agent", options.agent);
  }
  if (options.offline !== false) {
    args.push("--offline");
  }
  args.push(
    "--since",
    sinceDate,
    "--until",
    untilDate,
  );
  if (options.timezone) {
    args.push("--timezone", options.timezone);
  }
  return execAgentsViewAsync(args, timeoutMs);
}

export function parseAgentsViewOutput(raw: string): CcusageOutput {
  return parseDailyUsageOutput(raw, "agentsview");
}
