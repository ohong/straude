import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectCodexUsageAsync, hasCodexLogs } from "../src/lib/codex-native.js";

let homeDir: string;

async function writeSession(datePath: string, file: string, lines: unknown[]) {
  const dir = join(homeDir, "sessions", ...datePath.split("-"));
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, file),
    lines.map((line) => JSON.stringify(line)).join("\n") + "\n",
    "utf-8",
  );
}

function meta(id: string, timestamp = "2026-04-24T10:00:00.000Z", forked_from_id?: string) {
  return {
    timestamp,
    type: "session_meta",
    payload: {
      id,
      timestamp,
      ...(forked_from_id ? { forked_from_id } : {}),
    },
  };
}

function turn(model = "gpt-5") {
  return {
    timestamp: "2026-04-24T10:00:00.000Z",
    type: "turn_context",
    payload: { model },
  };
}

function token(timestamp: string, info: Record<string, unknown>) {
  return {
    timestamp,
    type: "event_msg",
    payload: {
      type: "token_count",
      info,
    },
  };
}

function usage(input: number, output = 0, cached = 0, reasoning = 0) {
  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: input + output,
  };
}

beforeEach(async () => {
  homeDir = await mkdtemp(join(tmpdir(), "straude-codex-"));
  vi.stubEnv("CODEX_HOME", homeDir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(homeDir, { recursive: true, force: true });
});

describe("native Codex collector", () => {
  it("detects local Codex session logs", async () => {
    expect(await hasCodexLogs()).toBe(false);
    await writeSession("2026-04-24", "session.jsonl", [meta("s1")]);
    expect(await hasCodexLogs()).toBe(true);
  });

  it("does not add last_token_usage when cumulative total_token_usage is unchanged", async () => {
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5"),
      token("2026-04-24T10:00:01.000Z", {
        total_token_usage: usage(1000),
        last_token_usage: usage(1000),
      }),
      token("2026-04-24T10:00:02.000Z", {
        total_token_usage: usage(1000),
        last_token_usage: usage(100),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.inputTokens).toBe(1000);
    expect(result.data[0]!.totalTokens).toBe(1000);
    expect(result.data[0]!.costUSD).toBeCloseTo(0.00125);
  });

  it("advances the cumulative baseline after last_token_usage-only records", async () => {
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5"),
      token("2026-04-24T11:00:01.000Z", {
        last_token_usage: usage(100),
      }),
      token("2026-04-24T11:00:02.000Z", {
        total_token_usage: usage(150),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    expect(result.data[0]!.inputTokens).toBe(150);
    expect(result.data[0]!.totalTokens).toBe(150);
    expect(result.data[0]!.costUSD).toBeCloseTo(0.0001875);
  });

  it("deduplicates token-count prefixes replayed by forked sessions", async () => {
    await writeSession("2026-04-24", "parent.jsonl", [
      meta("parent", "2026-04-24T12:00:00.000Z"),
      turn("gpt-5"),
      token("2026-04-24T12:00:01.000Z", {
        total_token_usage: usage(100),
      }),
    ]);
    await writeSession("2026-04-24", "child.jsonl", [
      meta("child", "2026-04-24T12:05:00.000Z", "parent"),
      turn("gpt-5"),
      token("2026-04-24T12:05:01.000Z", {
        total_token_usage: usage(100),
      }),
      token("2026-04-24T12:05:02.000Z", {
        total_token_usage: usage(150),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    expect(result.data[0]!.inputTokens).toBe(150);
    expect(result.data[0]!.totalTokens).toBe(150);
  });

  it("normalizes cached input and prices model breakdowns per model", async () => {
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5.4-mini"),
      token("2026-04-24T13:00:01.000Z", {
        total_token_usage: usage(1000, 200, 800),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    const entry = result.data[0]!;
    expect(entry.models).toEqual(["gpt-5.4-mini"]);
    expect(entry.inputTokens).toBe(200);
    expect(entry.cacheReadTokens).toBe(800);
    expect(entry.outputTokens).toBe(200);
    expect(entry.costUSD).toBeCloseTo((200 * 0.00000075) + (800 * 0.000000075) + (200 * 0.0000045));
    expect(entry.modelBreakdown).toEqual([{ model: "gpt-5.4-mini", cost_usd: entry.costUSD }]);
  });

  it("prices GPT-5.5 before falling back to GPT-5 pricing", async () => {
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5.5"),
      token("2026-04-24T14:00:01.000Z", {
        total_token_usage: usage(1000, 200, 800),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    const entry = result.data[0]!;
    expect(entry.models).toEqual(["gpt-5.5"]);
    expect(entry.costUSD).toBeCloseTo((200 * 0.000005) + (800 * 0.0000005) + (200 * 0.00003));
    expect(entry.modelBreakdown).toEqual([{ model: "gpt-5.5", cost_usd: entry.costUSD }]);
  });
});
