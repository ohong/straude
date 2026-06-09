import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { collectCcusageUsageAsync, _resetCcusageResolver } from "../src/lib/ccusage.js";

interface Scenario {
  name: string;
  startDay: number;
  days: number;
  eventsPerAgentDay: number;
  oldBaselineMedianMs: number;
}

const RUNS = Number(process.env.STRAUDE_CCUSAGE_BENCH_RUNS ?? 11);
const SHOULD_ASSERT = process.argv.includes("--assert");

const scenarios: Scenario[] = [
  {
    name: "steady-3d",
    startDay: 28,
    days: 3,
    eventsPerAgentDay: 9,
    oldBaselineMedianMs: 151.04,
  },
  {
    name: "migration-30d",
    startDay: 1,
    days: 30,
    eventsPerAgentDay: 9,
    oldBaselineMedianMs: 158.99,
  },
];

function compactDate(day: number): string {
  return `202604${String(day).padStart(2, "0")}`;
}

function iso(day: number, hour: number, minute: number, second: number): string {
  return `2026-04-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.000Z`;
}

function usage(input: number, output: number, cached: number, reasoning = 0): Record<string, number> {
  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: input + output,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

async function writeFixture(home: string, scenario: Scenario): Promise<void> {
  for (let offset = 0; offset < scenario.days; offset += 1) {
    const day = scenario.startDay + offset;
    const claudeDir = join(home, ".claude/projects/straude");
    await mkdir(claudeDir, { recursive: true });

    const claudeLines: string[] = [];
    for (let i = 0; i < scenario.eventsPerAgentDay; i += 1) {
      claudeLines.push(JSON.stringify({
        timestamp: iso(day, 10, i, 0),
        type: "assistant",
        message: {
          id: `msg_${day}_${i}`,
          type: "message",
          role: "assistant",
          model: i % 2 === 0 ? "claude-sonnet-4-5-20250929" : "claude-haiku-4-5-20251001",
          usage: {
            input_tokens: 1000 + i,
            cache_creation_input_tokens: i % 3 === 0 ? 50 : 0,
            cache_read_input_tokens: 200 + (i % 5),
            output_tokens: 100 + (i % 7),
          },
        },
      }));
    }
    await writeFile(
      join(claudeDir, `session-${String(day).padStart(2, "0")}.jsonl`),
      `${claudeLines.join("\n")}\n`,
      "utf8",
    );

    const codexDir = join(home, ".codex/sessions/2026/04", String(day).padStart(2, "0"));
    await mkdir(codexDir, { recursive: true });
    const codexLines = [
      JSON.stringify({
        timestamp: iso(day, 11, 0, 0),
        type: "session_meta",
        payload: { id: `codex-${day}`, timestamp: iso(day, 11, 0, 0) },
      }),
      JSON.stringify({
        timestamp: iso(day, 11, 0, 0),
        type: "turn_context",
        payload: { model: day % 2 === 0 ? "gpt-5.1-codex" : "gpt-5" },
      }),
    ];
    for (let i = 0; i < scenario.eventsPerAgentDay; i += 1) {
      codexLines.push(JSON.stringify({
        timestamp: iso(day, 11, i, 1),
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: usage(1000 + i * 3, 100 + (i % 7), 200 + (i % 5), i % 4 === 0 ? 20 : 0),
            last_token_usage: usage(100 + i, 20 + (i % 7), 40 + (i % 5), i % 4 === 0 ? 8 : 0),
          },
        },
      }));
    }
    await writeFile(
      join(codexDir, `session-${String(day).padStart(2, "0")}.jsonl`),
      `${codexLines.join("\n")}\n`,
      "utf8",
    );
  }
}

async function measureScenario(scenario: Scenario): Promise<{
  name: string;
  medianMs: number;
  minMs: number;
  maxMs: number;
  oldBaselineMedianMs: number;
  pricingMode: string;
  rows: number;
}> {
  const home = await mkdtemp(join(tmpdir(), `straude-${scenario.name}-`));
  const originalEnv = {
    HOME: process.env.HOME,
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
    CODEX_HOME: process.env.CODEX_HOME,
  };

  try {
    await writeFixture(home, scenario);
    process.env.HOME = home;
    process.env.CLAUDE_CONFIG_DIR = join(home, ".claude");
    process.env.CODEX_HOME = join(home, ".codex");

    const since = compactDate(scenario.startDay);
    const until = compactDate(scenario.startDay + scenario.days - 1);
    const samples: number[] = [];
    let rows = 0;
    let pricingMode = "unknown";

    _resetCcusageResolver();
    await collectCcusageUsageAsync(since, until, 60_000);

    for (let i = 0; i < RUNS; i += 1) {
      _resetCcusageResolver();
      const started = performance.now();
      const result = await collectCcusageUsageAsync(since, until, 60_000);
      samples.push(performance.now() - started);
      rows = result.data.length;
      pricingMode = result.pricingMode;
    }

    return {
      name: scenario.name,
      medianMs: median(samples),
      minMs: Math.min(...samples),
      maxMs: Math.max(...samples),
      oldBaselineMedianMs: scenario.oldBaselineMedianMs,
      pricingMode,
      rows,
    };
  } finally {
    process.env.HOME = originalEnv.HOME;
    process.env.CLAUDE_CONFIG_DIR = originalEnv.CLAUDE_CONFIG_DIR;
    process.env.CODEX_HOME = originalEnv.CODEX_HOME;
    await rm(home, { recursive: true, force: true });
  }
}

const results = [];
for (const scenario of scenarios) {
  results.push(await measureScenario(scenario));
}

console.table(results.map((result) => ({
  scenario: result.name,
  median_ms: result.medianMs.toFixed(2),
  old_baseline_ms: result.oldBaselineMedianMs.toFixed(2),
  delta_ms: (result.medianMs - result.oldBaselineMedianMs).toFixed(2),
  pricing_mode: result.pricingMode,
  rows: result.rows,
})));

if (SHOULD_ASSERT) {
  const failed = results.filter((result) => result.medianMs > result.oldBaselineMedianMs);
  if (failed.length > 0) {
    console.error("ccusage capture benchmark failed:", JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}
