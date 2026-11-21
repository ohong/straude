import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnCli, rmDir } from "./spawn";

/**
 * Real-binary e2e smoke tests. The previous CLI tests all import functions
 * from src/ and exercise them in-process. These tests do something none of
 * those can: they spawn the *built* `dist/index.js` as a separate Node
 * process with a controlled HOME, capture stdout/stderr/exit, and assert
 * on the observable behavior a user actually sees.
 *
 * What this catches that in-process tests cannot:
 *  - Build pipeline regressions (tsc emits broken JS, missing imports).
 *  - argv parsing breakage that doesn't surface when calling main() directly.
 *  - Real exit codes for help/version/error paths.
 *  - Real stdout output the user reads.
 *  - Future regressions to the CLI's startup-time behavior under real Node.
 *
 * Out of scope for this exemplar suite (tracked as follow-ups):
 *  - Full collection, signed-token rotation and browser sign-in are covered by
 *    the installed-package and combined browser journeys.
 *  - This suite checks only login rejection before any network/browser work.
 */

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "straude-e2e-"));
});
afterEach(() => {
  rmDir(home);
});

describe("straude binary — smoke", () => {
  it("--help prints usage and exits 0", async () => {
    const r = await spawnCli({ args: ["--help"], home });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toMatch(/Usage:/);
    expect(r.stdout).toMatch(/straude\s*<command>/);
  });

  it("-h is an alias for --help", async () => {
    const r = await spawnCli({ args: ["-h"], home });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Usage:/);
  });

  it("--version prints the package version and exits 0", async () => {
    // Read the pinned version straight from package.json — no source-of-truth
    // drift between this assertion and what the build embeds.
    const pkg = await import(join(PKG_DIR, "package.json"), { with: { type: "json" } });
    const version = (pkg as unknown as { default: { version: string } }).default.version;

    const r = await spawnCli({ args: ["--version"], home });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe(`straude v${version}`);
  });

  it("-v is an alias for --version", async () => {
    const r = await spawnCli({ args: ["-v"], home });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/^straude v/);
  });

  it("unknown command prints the help and exits non-zero", async () => {
    const r = await spawnCli({ args: ["nonsense"], home });
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toMatch(/Unknown command/);
  });

  it("login --non-interactive exits with guidance before device initialization", async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Login must not reach this server" }));
    });
    await new Promise<void>(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
    try {
      const address = server.address() as AddressInfo;
      const r = await spawnCli({
        args: ["login", "--non-interactive", "--api-url", `http://127.0.0.1:${address.port}`],
        home,
      });
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toMatch(/interactive terminal/);
      expect(r.stderr).toMatch(/straude login/);
      expect(r.stdout).not.toContain("Opening browser");
      expect(requests).toBe(0);
      expect(existsSync(join(home, ".straude", "config.json"))).toBe(false);
      expect(existsSync(join(home, ".straude", "sync-health.json"))).toBe(false);
    } finally {
      await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    }
  });

  it("--version does not create an authenticated config", async () => {
    // First-run telemetry may create ~/.straude metadata, but version reads
    // must never create an auth config or require a logged-in account.
    const r = await spawnCli({ args: ["--version"], home });
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(home, ".straude", "config.json"))).toBe(false);
  });
});
