import { spawn, type SpawnOptions } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate the built CLI binary. Tests assume `bun run --cwd packages/cli build`
 * has run — see `e2e/setup.ts`. We don't rebuild from inside each test
 * because tsc takes ~3s and the e2e suite shares one binary.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
export const CLI_DIST_ENTRY = resolve(__dirname, "../../dist/index.js");

export interface SpawnResult {
  /** Full captured stdout (utf-8). */
  stdout: string;
  /** Full captured stderr (utf-8). */
  stderr: string;
  /** Process exit code. `null` if the process was killed by a signal. */
  exitCode: number | null;
  /** Signal that killed the process, or `null` if it exited normally. */
  signal: NodeJS.Signals | null;
}

export interface SpawnCliOptions {
  /** Args passed to `node dist/index.js`. */
  args: string[];
  /**
   * Directory used as $HOME — config and machine_id live under
   * `${home}/.straude`. A fresh tmpdir is created if not supplied so
   * tests don't accidentally read or mutate the real user's config.
   */
  home?: string;
  /** Environment overrides merged on top of a minimal scrubbed base. */
  env?: NodeJS.ProcessEnv;
  /**
   * If true, child stdout is piped to a child of /dev/null-equivalent so
   * EPIPE behaves like `straude … | head` would. Default false.
   */
  truncateStdout?: boolean;
  /** Timeout in ms before killing the child. Default 15s. */
  timeoutMs?: number;
}

/**
 * Spawn the real CLI binary in a controlled environment and return
 * exit/output. No mocks of fs, env, or fetch — this is the real argv
 * parser running the real entry point against the real filesystem
 * (in a tmpdir HOME) and the real Node runtime.
 */
export function spawnCli(opts: SpawnCliOptions): Promise<SpawnResult> {
  const home = opts.home ?? mkdtempSync(join(tmpdir(), "straude-e2e-"));
  // Make sure ~/.straude exists if the test wants it; otherwise the CLI's
  // own first-run path creates it. Either is fine.
  mkdirSync(home, { recursive: true });

  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    // Scrub anything that could make the CLI behave differently in tests.
    STRAUDE_TELEMETRY_DISABLED: "1",
    NODE_ENV: "test",
    ...opts.env,
    HOME: home,
  };

  return new Promise((resolveResult, reject) => {
    const spawnOpts: SpawnOptions = {
      env,
      stdio: opts.truncateStdout ? ["ignore", "pipe", "pipe"] : "pipe",
    };
    const child = spawn(process.execPath, [CLI_DIST_ENTRY, ...opts.args], spawnOpts);

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
      if (opts.truncateStdout) {
        // Close the pipe after the first chunk so the writer hits EPIPE on
        // the next write — same shape as `straude --help | head -1`.
        child.stdout?.destroy();
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`spawnCli timed out after ${opts.timeoutMs ?? 15_000}ms`));
    }, opts.timeoutMs ?? 15_000);

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolveResult({ stdout, stderr, exitCode, signal });
    });
  });
}

/** Cleanup helper — removes a tmpdir HOME from `spawnCli`. Best effort. */
export function rmDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
