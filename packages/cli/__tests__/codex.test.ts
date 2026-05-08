import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectCodexUsageAsync, containsSessionFile } from "../src/lib/codex-native.js";

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
    expect(await containsSessionFile()).toBe(false);
    await writeSession("2026-04-24", "session.jsonl", [meta("s1")]);
    expect(await containsSessionFile()).toBe(true);
  });

  it("records fresh last_token_usage when cumulative total_token_usage is unchanged", async () => {
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
    expect(result.data[0]!.inputTokens).toBe(1100);
    expect(result.data[0]!.totalTokens).toBe(1100);
    expect(result.data[0]!.costUSD).toBeCloseTo(0.001375);
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

  it("uses the parent cumulative snapshot at fork time for total-only child sessions", async () => {
    await writeSession("2026-04-24", "parent.jsonl", [
      meta("parent", "2026-04-24T12:00:00.000Z"),
      turn("gpt-5"),
      token("2026-04-24T12:00:01.000Z", {
        total_token_usage: usage(100),
      }),
      token("2026-04-24T12:10:00.000Z", {
        total_token_usage: usage(500),
      }),
    ]);
    await writeSession("2026-04-24", "child.jsonl", [
      meta("child", "2026-04-24T12:05:00.000Z", "parent"),
      turn("gpt-5"),
      token("2026-04-24T12:05:01.000Z", {
        total_token_usage: usage(150),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    expect(result.data[0]!.inputTokens).toBe(550);
    expect(result.data[0]!.totalTokens).toBe(550);
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

  it("prices GPT-5.5 Pro without a cache-read discount", async () => {
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5.5-pro"),
      token("2026-04-24T14:00:01.000Z", {
        total_token_usage: usage(1000, 200, 800),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    const entry = result.data[0]!;
    expect(entry.models).toEqual(["gpt-5.5-pro"]);
    expect(entry.costUSD).toBeCloseTo((200 * 0.00003) + (800 * 0.00003) + (200 * 0.00018));
    expect(entry.modelBreakdown).toEqual([{ model: "gpt-5.5-pro", cost_usd: entry.costUSD }]);
  });

  it("clamps cached_input_tokens to input_tokens and emits an anomaly when source data is impossible", async () => {
    // Pathological input: Codex schema guarantees cached ≤ input, but some
    // upstream replay/fork edge cases produced rows where cached >> input.
    // The collector must clamp rather than letting cache_read leak past input
    // (which would price as cache-rate × billions of tokens).
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5.5"),
      token("2026-04-24T14:00:01.000Z", {
        total_token_usage: usage(1_000_000, 100_000, 50_000_000),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    const entry = result.data[0]!;
    expect(entry.inputTokens).toBe(0);
    expect(entry.cacheReadTokens).toBe(1_000_000);
    expect(entry.outputTokens).toBe(100_000);
    expect(entry.costUSD).toBeCloseTo((1_000_000 * 0.0000005) + (100_000 * 0.00003));
    expect(result.anomalies?.length).toBeGreaterThan(0);
    expect(result.anomalies?.[0]?.warnings.some((w) => w.includes("clamped"))).toBe(true);
  });

  it("never lets cache_read_tokens exceed input_tokens after aggregation across many events", async () => {
    // Simulates the May-4 inflation pattern: many cumulative-total events where
    // cumulative cached drifts above cumulative input due to upstream replay.
    // After bucket aggregation the deterministic clamp must still hold.
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5.5"),
      token("2026-04-24T14:00:01.000Z", { total_token_usage: usage(100, 50, 80) }),
      token("2026-04-24T14:00:02.000Z", { total_token_usage: usage(200, 100, 250) }),
      token("2026-04-24T14:00:03.000Z", { total_token_usage: usage(300, 150, 1000) }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    const entry = result.data[0]!;
    expect(entry.cacheReadTokens).toBeLessThanOrEqual(entry.inputTokens + entry.cacheReadTokens);
    expect(entry.cacheReadTokens + entry.inputTokens).toBe(300);
    expect(entry.cacheReadTokens).toBe(300);
    expect(entry.inputTokens).toBe(0);
  });

  it("preserves ordinary inclusive-cache semantics when cache ≤ input", async () => {
    // Sanity: typical case where cached is a clean subset of input.
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5"),
      token("2026-04-24T14:00:01.000Z", {
        total_token_usage: usage(10_000, 1_000, 6_000),
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    const entry = result.data[0]!;
    expect(entry.inputTokens).toBe(4_000);
    expect(entry.cacheReadTokens).toBe(6_000);
    expect(entry.outputTokens).toBe(1_000);
    expect(entry.costUSD).toBeCloseTo((4_000 * 0.00000125) + (6_000 * 0.000000125) + (1_000 * 0.00001));
  });

  it("uses last_token_usage to bill per-request — context-prune oscillation must not inflate", async () => {
    // Real Codex sessions emit `total_token_usage` as the *current request's*
    // context snapshot, not session cumulative. The IDE periodically prunes
    // the conversation context, which causes the snapshot to drop and grow
    // again. Computing deltas via cumulative subtraction over-counts every
    // prune-then-regrow cycle (verified to inflate by 70x on real data).
    // Per-event billing comes from `last_token_usage` — the token cost of
    // the single request that produced the event.
    //
    // This fixture simulates 5 requests, each costing 100 input + 200 cached
    // + 20 output, with the context size oscillating around 1000 input as
    // the IDE prunes between requests. Expected total = 5 × per-request cost.
    await writeSession("2026-04-24", "session.jsonl", [
      meta("s1"),
      turn("gpt-5"),
      token("2026-04-24T15:00:01.000Z", {
        total_token_usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 20, reasoning_output_tokens: 0, total_tokens: 1020 },
        last_token_usage:  { input_tokens:  100, cached_input_tokens: 200, output_tokens: 20, reasoning_output_tokens: 0, total_tokens:  120 },
      }),
      token("2026-04-24T15:00:02.000Z", {
        total_token_usage: { input_tokens: 1100, cached_input_tokens: 900, output_tokens: 40, reasoning_output_tokens: 0, total_tokens: 1140 },
        last_token_usage:  { input_tokens:  100, cached_input_tokens: 200, output_tokens: 20, reasoning_output_tokens: 0, total_tokens:  120 },
      }),
      // Prune: total drops back below the previous snapshot.
      token("2026-04-24T15:00:03.000Z", {
        total_token_usage: { input_tokens:  900, cached_input_tokens: 700, output_tokens: 60, reasoning_output_tokens: 0, total_tokens:  960 },
        last_token_usage:  { input_tokens:  100, cached_input_tokens: 200, output_tokens: 20, reasoning_output_tokens: 0, total_tokens:  120 },
      }),
      token("2026-04-24T15:00:04.000Z", {
        total_token_usage: { input_tokens: 1050, cached_input_tokens: 850, output_tokens: 80, reasoning_output_tokens: 0, total_tokens: 1130 },
        last_token_usage:  { input_tokens:  100, cached_input_tokens: 200, output_tokens: 20, reasoning_output_tokens: 0, total_tokens:  120 },
      }),
      // Duplicate emission of the prior event: same total AND last. Must
      // dedupe (Codex really does re-emit identical events).
      token("2026-04-24T15:00:05.000Z", {
        total_token_usage: { input_tokens: 1050, cached_input_tokens: 850, output_tokens: 80, reasoning_output_tokens: 0, total_tokens: 1130 },
        last_token_usage:  { input_tokens:  100, cached_input_tokens: 200, output_tokens: 20, reasoning_output_tokens: 0, total_tokens:  120 },
      }),
      token("2026-04-24T15:00:06.000Z", {
        total_token_usage: { input_tokens: 1150, cached_input_tokens: 950, output_tokens: 100, reasoning_output_tokens: 0, total_tokens: 1250 },
        last_token_usage:  { input_tokens:  100, cached_input_tokens: 200, output_tokens: 20, reasoning_output_tokens: 0, total_tokens:  120 },
      }),
    ]);

    const result = await collectCodexUsageAsync("20260424", "20260424");
    const entry = result.data[0]!;
    // 5 distinct requests × 100 input + 200 cached + 20 output each
    // (1 of 6 events was a duplicate emission, must be skipped).
    // After inclusive-cache clamp at the bucket level: cacheRead=min(cached, input).
    // Sum of last: input=500, cached=1000 → cache > input, clamp:
    // bucket cacheRead = 500, bucket input = 0. Output untouched.
    expect(entry.inputTokens).toBe(0);
    expect(entry.cacheReadTokens).toBe(500);
    expect(entry.outputTokens).toBe(100);
    expect(entry.costUSD).toBeCloseTo((0 * 0.00000125) + (500 * 0.000000125) + (100 * 0.00001));
  });
});
