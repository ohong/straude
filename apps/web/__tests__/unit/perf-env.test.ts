import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertPerfSupabaseUrl, loadWebEnv } from "@/e2e/perf/env";

describe("perf environment", () => {
  it("lets process.env override values from .env.local", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "straude-perf-env-"));
    const envFilePath = path.join(directory, ".env.local");
    writeFileSync(
      envFilePath,
      "NEXT_PUBLIC_SUPABASE_URL=https://production.supabase.co\nPERF_TEST_EMAIL=file@example.com\n"
    );

    try {
      const env = loadWebEnv({
        envFilePath,
        processEnv: {
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          PERF_TEST_EMAIL: "runtime@example.com",
        },
      });

      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
      expect(env.PERF_TEST_EMAIL).toBe("runtime@example.com");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("supports a missing .env.local", () => {
    const env = loadWebEnv({
      envFilePath: path.join(os.tmpdir(), "straude-perf-env-missing", ".env.local"),
      processEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" },
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://localhost:54321");
  });

  it("rejects a remote Supabase URL unless explicitly enabled", () => {
    expect(() => assertPerfSupabaseUrl("https://production.supabase.co", undefined)).toThrow(
      /PERF_ALLOW_REMOTE=1/
    );
    expect(() => assertPerfSupabaseUrl("https://production.supabase.co", "1")).not.toThrow();
  });

  it.each(["http://localhost:54321", "http://127.0.0.1:54321", "http://[::1]:54321"])(
    "accepts loopback Supabase URL %s",
    (url) => {
      expect(() => assertPerfSupabaseUrl(url, undefined)).not.toThrow();
    }
  );

  it("rejects non-http URLs even with remote access enabled", () => {
    expect(() => assertPerfSupabaseUrl("ftp://production.supabase.co", "1")).toThrow(
      /http or https/
    );
  });
});
