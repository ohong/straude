# Gemini CLI Integration via gemistat

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Gemini CLI usage tracking to Straude by integrating gemistat (the ccusage equivalent for Gemini CLI), so users who code with Gemini CLI see their Gemini spend merged into their daily Straude posts alongside Claude Code and Codex data.

**Architecture:** Create `packages/cli/src/lib/gemini.ts` mirroring the existing `codex.ts` pattern — run `gemistat daily --json` as a subprocess, parse output into `CcusageDailyEntry[]`, merge with Claude+Codex data in `push.ts`. Silent failure like Codex (users without Gemini CLI are unaffected). Add Gemini model colors to the CLI theme and prettifyModel to both CLI and web.

**Tech Stack:** TypeScript, Node child_process, Vitest, Ink (React CLI)

---

### Task 1: Add `"gemini"` to token normalization source hints

**Files:**
- Modify: `packages/cli/src/lib/token-normalization.ts:37` (TokenSourceHints)
- Modify: `packages/cli/src/lib/ccusage.ts:169` (NormalizationAnomaly source union)

**Step 1: Update TokenSourceHints source type**

In `packages/cli/src/lib/token-normalization.ts`, line 37, change:

```typescript
source: "codex" | "ccusage" | "generic";
```

to:

```typescript
source: "codex" | "ccusage" | "gemini" | "generic";
```

**Step 2: Update NormalizationAnomaly source type**

In `packages/cli/src/lib/ccusage.ts`, line 169, change:

```typescript
source: "ccusage" | "codex";
```

to:

```typescript
source: "ccusage" | "codex" | "gemini";
```

**Step 3: Run existing tests to verify no regressions**

Run: `cd packages/cli && bun run test`
Expected: All existing tests pass (these are type-only changes).

**Step 4: Commit**

```bash
git add packages/cli/src/lib/token-normalization.ts packages/cli/src/lib/ccusage.ts
git commit -m "feat(cli): add gemini to token normalization source hints"
```

---

### Task 2: Create `gemini.ts` — gemistat subprocess runner and parser

**Files:**
- Create: `packages/cli/src/lib/gemini.ts`
- Test: `packages/cli/__tests__/gemini.test.ts`

**Step 1: Write the failing tests**

Create `packages/cli/__tests__/gemini.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseGeminiOutput, runGeminiRaw } from "../src/lib/gemini.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

import { execFileSync } from "node:child_process";
const mockExecFileSync = vi.mocked(execFileSync);

/** Build a valid gemistat daily --json output string. */
function validOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2026-04-01",
        modelsUsed: ["gemini-2.5-pro"],
        inputTokens: 5000,
        outputTokens: 1200,
        cacheCreationTokens: 0,
        cacheReadTokens: 800,
        totalCost: 0.45,
      },
    ],
    totals: {
      inputTokens: 5000,
      outputTokens: 1200,
      cacheCreationTokens: 0,
      cacheReadTokens: 800,
      totalCost: 0.45,
    },
  });
}

/** Multi-model output. */
function multiModelOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2026-04-01",
        modelsUsed: ["gemini-2.5-pro", "gemini-2.5-flash"],
        inputTokens: 10000,
        outputTokens: 3000,
        cacheCreationTokens: 200,
        cacheReadTokens: 1500,
        totalCost: 1.25,
      },
    ],
    totals: {
      inputTokens: 10000,
      outputTokens: 3000,
      cacheCreationTokens: 200,
      cacheReadTokens: 1500,
      totalCost: 1.25,
    },
  });
}

// ---------------------------------------------------------------------------
// parseGeminiOutput
// ---------------------------------------------------------------------------

describe("parseGeminiOutput", () => {
  it("parses valid gemistat JSON and normalizes fields", () => {
    const result = parseGeminiOutput(validOutput());
    expect(result.data).toHaveLength(1);
    const entry = result.data[0]!;
    expect(entry.date).toBe("2026-04-01");
    expect(entry.costUSD).toBe(0.45);
    expect(entry.models).toEqual(["gemini-2.5-pro"]);
    expect(entry.inputTokens).toBe(5000);
    expect(entry.outputTokens).toBe(1200);
    expect(entry.cacheReadTokens).toBe(800);
    expect(entry.cacheCreationTokens).toBe(0);
    // totalTokens computed: 5000 + 1200 + 0 + 800 = 7000
    expect(entry.totalTokens).toBe(7000);
  });

  it("parses multi-model output", () => {
    const result = parseGeminiOutput(multiModelOutput());
    expect(result.data).toHaveLength(1);
    const entry = result.data[0]!;
    expect(entry.models).toEqual(["gemini-2.5-pro", "gemini-2.5-flash"]);
    expect(entry.costUSD).toBe(1.25);
  });

  it("returns empty data for invalid JSON", () => {
    const result = parseGeminiOutput("not json");
    expect(result.data).toEqual([]);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies?.[0]?.mode).toBe("unresolved");
  });

  it("returns empty data for empty array", () => {
    const result = parseGeminiOutput("[]");
    expect(result.data).toEqual([]);
  });

  it("returns empty data when daily is missing", () => {
    const result = parseGeminiOutput(JSON.stringify({ something: "else" }));
    expect(result.data).toEqual([]);
  });

  it("filters out entries with missing date", () => {
    const raw = JSON.stringify({
      daily: [
        { totalCost: 1, modelsUsed: [], inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
        { date: "2026-04-01", totalCost: 0.05, modelsUsed: ["gemini-2.5-flash"], inputTokens: 50, outputTokens: 50, cacheCreationTokens: 0, cacheReadTokens: 0 },
      ],
      totals: {},
    });
    const result = parseGeminiOutput(raw);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.date).toBe("2026-04-01");
  });

  it("filters out entries with negative cost", () => {
    const raw = JSON.stringify({
      daily: [
        { date: "2026-04-01", totalCost: -1, modelsUsed: [], inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      ],
      totals: {},
    });
    const result = parseGeminiOutput(raw);
    expect(result.data).toEqual([]);
  });

  it("handles entries without cache tokens", () => {
    const raw = JSON.stringify({
      daily: [
        {
          date: "2026-04-01",
          modelsUsed: ["gemini-2.5-flash-lite"],
          inputTokens: 500,
          outputTokens: 200,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalCost: 0.03,
        },
      ],
      totals: {},
    });
    const result = parseGeminiOutput(raw);
    expect(result.data[0]!.cacheCreationTokens).toBe(0);
    expect(result.data[0]!.cacheReadTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runGeminiRaw — silent failure
// ---------------------------------------------------------------------------

describe("runGeminiRaw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileSync.mockReturnValue(validOutput() as never);
  });

  it("returns raw JSON string on success", () => {
    const result = runGeminiRaw("20260401", "20260401");
    expect(result).toBe(validOutput());
  });

  it("returns empty string on failure (silent)", () => {
    mockExecFileSync.mockImplementation(() => { throw new Error("fail"); });
    const result = runGeminiRaw("20260401", "20260401");
    expect(result).toBe("");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && bun run test -- gemini`
Expected: FAIL — `../src/lib/gemini.js` does not exist.

**Step 3: Write the implementation**

Create `packages/cli/src/lib/gemini.ts`:

```typescript
import { execFileSync, execFile as execFileCb } from "node:child_process";
import type { CcusageDailyEntry, NormalizationAnomaly } from "./ccusage.js";
import {
  normalizeTokenBuckets,
  summarizeNormalization,
  type NormalizationMeta,
  type NormalizationSummary,
} from "./token-normalization.js";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../config.js";

export interface GeminiOutput {
  data: CcusageDailyEntry[];
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
  entryMeta?: Array<{ date: string; meta: NormalizationMeta }>;
}

const GEMINI_PKG = "gemistat";

/** Returns the raw JSON string from gemistat (for hashing). Empty string on failure. */
export function runGeminiRaw(sinceDate: string, untilDate: string, timeoutMs?: number): string {
  try {
    return execGemini(["daily", "--json", "--since", sinceDate, "--until", untilDate], timeoutMs);
  } catch {
    return "";
  }
}

/** Async version — returns raw JSON string without blocking. Empty string on failure. */
export async function runGeminiRawAsync(sinceDate: string, untilDate: string, timeoutMs?: number): Promise<string> {
  try {
    return await execGeminiAsync(["daily", "--json", "--since", sinceDate, "--until", untilDate], timeoutMs);
  } catch {
    return "";
  }
}

function execGemini(args: string[], timeoutMs?: number): string {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return execFileSync(cmd, [...prefix, GEMINI_PKG, ...args], {
    encoding: "utf-8",
    timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
  });
}

function execGeminiAsync(args: string[], timeoutMs?: number): Promise<string> {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return new Promise((resolve, reject) => {
    execFileCb(cmd, [...prefix, GEMINI_PKG, ...args], {
      encoding: "utf-8",
      timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/**
 * Raw shape returned by gemistat (`daily --json`).
 *
 * gemistat follows the same conventions as ccusage:
 * - Cost: `totalCost`
 * - Date: ISO 8601 ("2026-04-01")
 * - Models: `modelsUsed: string[]`
 * - Cache: `cacheReadTokens` is separate from `inputTokens`
 *
 * Notable difference: no `totalTokens` field — we compute it.
 */
interface GeminiRawEntry {
  date: string;
  modelsUsed: string[];
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost: number;
}

interface GeminiDailyOutput {
  daily: GeminiRawEntry[];
  totals?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCost: number;
  };
}

export function parseGeminiOutput(raw: string): GeminiOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      data: [],
      anomalies: [{
        date: "unknown",
        source: "gemini",
        mode: "unresolved",
        confidence: "low",
        consistencyError: 0,
        warnings: ["Failed to parse gemistat JSON output."],
      }],
      normalizationSummary: {
        total: 1,
        anomalies: 1,
        byMode: { unresolved: 1 },
        byConfidence: { low: 1 },
      },
    };
  }

  // Empty array = no data
  if (Array.isArray(parsed) && (parsed as unknown[]).length === 0) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  const output = parsed as GeminiDailyOutput;
  if (!output.daily || !Array.isArray(output.daily)) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  const normalizedRows = output.daily
    .filter((e) => {
      return e.date && typeof e.totalCost === "number" && e.totalCost >= 0;
    })
    .map((e) => {
      // gemistat does not provide totalTokens — compute it
      const computedTotal = (e.inputTokens || 0) + (e.outputTokens || 0) +
        (e.cacheCreationTokens || 0) + (e.cacheReadTokens || 0);

      const normalized = normalizeTokenBuckets(
        {
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
          cacheCreationTokens: e.cacheCreationTokens,
          cacheReadTokens: e.cacheReadTokens,
          totalTokens: computedTotal,
        },
        { source: "gemini", cacheSemantics: "separate" },
      );

      return {
        date: e.date,
        meta: normalized.meta,
        entry: {
          date: e.date,
          models: Array.isArray(e.modelsUsed) ? e.modelsUsed : [],
          inputTokens: normalized.normalized.inputTokens,
          outputTokens: normalized.normalized.outputTokens,
          cacheCreationTokens: normalized.normalized.cacheCreationTokens,
          cacheReadTokens: normalized.normalized.cacheReadTokens,
          totalTokens: normalized.normalized.totalTokens,
          costUSD: e.totalCost,
        } satisfies CcusageDailyEntry,
      };
    });

  const anomalies: NormalizationAnomaly[] = normalizedRows
    .filter((row) => row.meta.mode === "unresolved" || row.meta.confidence !== "high" || row.meta.warnings.length > 0)
    .map((row) => ({
      date: row.date,
      source: "gemini",
      mode: row.meta.mode,
      confidence: row.meta.confidence,
      consistencyError: row.meta.consistencyError,
      warnings: row.meta.warnings,
    }));

  return {
    data: normalizedRows.map((row) => row.entry),
    anomalies,
    normalizationSummary: summarizeNormalization(normalizedRows.map((row) => row.meta)),
    entryMeta: normalizedRows.map((row) => ({ date: row.date, meta: row.meta })),
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && bun run test -- gemini`
Expected: All 9 tests PASS.

**Step 5: Run the full test suite**

Run: `cd packages/cli && bun run test`
Expected: All tests pass including existing ones.

**Step 6: Commit**

```bash
git add packages/cli/src/lib/gemini.ts packages/cli/__tests__/gemini.test.ts
git commit -m "feat(cli): add gemistat integration for Gemini CLI usage tracking"
```

---

### Task 3: Extend `mergeEntries()` to support 3-way merge and integrate into push flow

**Files:**
- Modify: `packages/cli/src/commands/push.ts`
- Test: `packages/cli/__tests__/commands/push.test.ts`

**Step 1: Write the failing test for 3-way merge**

Add to `packages/cli/__tests__/commands/push.test.ts` (or create a new `packages/cli/__tests__/merge.test.ts` if the file doesn't exist):

```typescript
import { describe, it, expect } from "vitest";
import { mergeEntries } from "../src/commands/push.js";

describe("mergeEntries with gemini", () => {
  it("merges claude + codex + gemini entries by date", () => {
    const claude = [{
      date: "2026-04-01",
      models: ["Claude Opus"],
      inputTokens: 1000, outputTokens: 500,
      cacheCreationTokens: 0, cacheReadTokens: 100,
      totalTokens: 1600, costUSD: 2.00,
    }];
    const codex = [{
      date: "2026-04-01",
      models: ["GPT-5"],
      inputTokens: 800, outputTokens: 300,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 1100, costUSD: 0.50,
    }];
    const gemini = [{
      date: "2026-04-01",
      models: ["gemini-2.5-pro"],
      inputTokens: 5000, outputTokens: 1200,
      cacheCreationTokens: 0, cacheReadTokens: 800,
      totalTokens: 7000, costUSD: 0.45,
    }];
    const merged = mergeEntries(claude, codex, gemini);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.costUSD).toBe(2.95);
    expect(merged[0]!.models).toEqual(["Claude Opus", "GPT-5", "gemini-2.5-pro"]);
    expect(merged[0]!.inputTokens).toBe(6800);
    expect(merged[0]!.totalTokens).toBe(9700);
  });

  it("handles gemini-only dates", () => {
    const merged = mergeEntries([], [], [{
      date: "2026-04-02",
      models: ["gemini-2.5-flash"],
      inputTokens: 2000, outputTokens: 500,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 2500, costUSD: 0.10,
    }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.models).toEqual(["gemini-2.5-flash"]);
  });

  it("backward compatible — works without gemini argument", () => {
    const claude = [{
      date: "2026-04-01", models: ["Claude Opus"],
      inputTokens: 1000, outputTokens: 500,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 1500, costUSD: 2.00,
    }];
    const merged = mergeEntries(claude, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.costUSD).toBe(2.00);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/cli && bun run test -- merge`
Expected: FAIL — `mergeEntries` does not accept 3rd argument (or test for 3-way behavior fails).

**Step 3: Update `mergeEntries` signature and body**

In `packages/cli/src/commands/push.ts`, update `mergeEntries` (lines 108-147):

Change the function signature from:
```typescript
export function mergeEntries(
  claudeEntries: CcusageDailyEntry[],
  codexEntries: CcusageDailyEntry[],
): CcusageDailyEntry[] {
  const byDate = new Map<string, { claude?: CcusageDailyEntry; codex?: CcusageDailyEntry }>();

  for (const e of claudeEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), claude: e });
  }
  for (const e of codexEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), codex: e });
  }

  const merged: CcusageDailyEntry[] = [];

  for (const [date, { claude, codex }] of byDate) {
    const claudeBreakdown = claude ? buildBreakdown(claude) : [];
    const codexBreakdown = codex ? buildBreakdown(codex) : [];
    const modelBreakdown = [...claudeBreakdown, ...codexBreakdown];

    merged.push({
      date,
      models: [
        ...(claude?.models ?? []),
        ...(codex?.models ?? []),
      ],
      inputTokens: (claude?.inputTokens ?? 0) + (codex?.inputTokens ?? 0),
      outputTokens: (claude?.outputTokens ?? 0) + (codex?.outputTokens ?? 0),
      cacheCreationTokens: (claude?.cacheCreationTokens ?? 0) + (codex?.cacheCreationTokens ?? 0),
      cacheReadTokens: (claude?.cacheReadTokens ?? 0) + (codex?.cacheReadTokens ?? 0),
      totalTokens: (claude?.totalTokens ?? 0) + (codex?.totalTokens ?? 0),
      costUSD: (claude?.costUSD ?? 0) + (codex?.costUSD ?? 0),
      modelBreakdown: modelBreakdown.length > 0 ? modelBreakdown : undefined,
    });
  }

  // Sort by date ascending
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}
```

To:
```typescript
export function mergeEntries(
  claudeEntries: CcusageDailyEntry[],
  codexEntries: CcusageDailyEntry[],
  geminiEntries: CcusageDailyEntry[] = [],
): CcusageDailyEntry[] {
  const byDate = new Map<string, { claude?: CcusageDailyEntry; codex?: CcusageDailyEntry; gemini?: CcusageDailyEntry }>();

  for (const e of claudeEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), claude: e });
  }
  for (const e of codexEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), codex: e });
  }
  for (const e of geminiEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), gemini: e });
  }

  const merged: CcusageDailyEntry[] = [];

  for (const [date, { claude, codex, gemini }] of byDate) {
    const claudeBreakdown = claude ? buildBreakdown(claude) : [];
    const codexBreakdown = codex ? buildBreakdown(codex) : [];
    const geminiBreakdown = gemini ? buildBreakdown(gemini) : [];
    const modelBreakdown = [...claudeBreakdown, ...codexBreakdown, ...geminiBreakdown];

    merged.push({
      date,
      models: [
        ...(claude?.models ?? []),
        ...(codex?.models ?? []),
        ...(gemini?.models ?? []),
      ],
      inputTokens: (claude?.inputTokens ?? 0) + (codex?.inputTokens ?? 0) + (gemini?.inputTokens ?? 0),
      outputTokens: (claude?.outputTokens ?? 0) + (codex?.outputTokens ?? 0) + (gemini?.outputTokens ?? 0),
      cacheCreationTokens: (claude?.cacheCreationTokens ?? 0) + (codex?.cacheCreationTokens ?? 0) + (gemini?.cacheCreationTokens ?? 0),
      cacheReadTokens: (claude?.cacheReadTokens ?? 0) + (codex?.cacheReadTokens ?? 0) + (gemini?.cacheReadTokens ?? 0),
      totalTokens: (claude?.totalTokens ?? 0) + (codex?.totalTokens ?? 0) + (gemini?.totalTokens ?? 0),
      costUSD: (claude?.costUSD ?? 0) + (codex?.costUSD ?? 0) + (gemini?.costUSD ?? 0),
      modelBreakdown: modelBreakdown.length > 0 ? modelBreakdown : undefined,
    });
  }

  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}
```

**Step 4: Update the push command flow**

In the same file, add the import at the top (after the codex import, line 9):

```typescript
import { runGeminiRawAsync, parseGeminiOutput } from "../lib/gemini.js";
```

Update the `Promise.all` call (lines 236-239) from:

```typescript
const [claudeResult, codexRaw] = await Promise.all([
  runCcusageRawAsync(sinceStr, untilStr, options.timeoutMs).catch((err: Error) => err),
  runCodexRawAsync(sinceStr, untilStr, options.timeoutMs),
]);
```

To:

```typescript
const [claudeResult, codexRaw, geminiRaw] = await Promise.all([
  runCcusageRawAsync(sinceStr, untilStr, options.timeoutMs).catch((err: Error) => err),
  runCodexRawAsync(sinceStr, untilStr, options.timeoutMs),
  runGeminiRawAsync(sinceStr, untilStr, options.timeoutMs),
]);
```

After the codex parsing section (after line 293), add gemini parsing:

```typescript
// Gemini data — silent on fetch failure, surface parser anomalies.
const geminiParsed = geminiRaw ? parseGeminiOutput(geminiRaw) : { data: [], anomalies: [], entryMeta: [] };
const allAnomalies = [...claudeAnomalies, ...(codexParsed.anomalies ?? []), ...(geminiParsed.anomalies ?? [])];
```

(Remove the existing `allAnomalies` line at 268 since we're replacing it.)

After the codex blocked-dates logic, add gemini blocked-dates:

```typescript
const geminiMetaByDate = new Map((geminiParsed.entryMeta ?? []).map((row) => [row.date, row.meta]));
const geminiBlockedDates = new Set<string>();

for (const [date, meta] of geminiMetaByDate) {
  if (meta.mode === "unresolved") {
    geminiBlockedDates.add(date);
  }
}

if (geminiBlockedDates.size > 0) {
  const blocked = [...geminiBlockedDates].sort();
  console.log(`Warning: skipping Gemini rows for ${blocked.length} date(s) due to unresolved normalization: ${blocked.join(", ")}`);
}

const geminiEntries = geminiParsed.data.filter((entry) => !geminiBlockedDates.has(entry.date));
```

Update the merge call (line 296) from:

```typescript
const entries = mergeEntries(claudeEntries, codexEntries);
```

To:

```typescript
const entries = mergeEntries(claudeEntries, codexEntries, geminiEntries);
```

Update the hash computation (line 331) from:

```typescript
const hashInput = codexRaw ? claudeRaw + codexRaw : claudeRaw;
```

To:

```typescript
const hashInput = claudeRaw + codexRaw + geminiRaw;
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/cli && bun run test`
Expected: All tests pass including the new merge tests.

**Step 6: Commit**

```bash
git add packages/cli/src/commands/push.ts packages/cli/__tests__/commands/push.test.ts
git commit -m "feat(cli): integrate gemini into push flow with 3-way merge"
```

---

### Task 4: Add Gemini model colors to CLI theme

**Files:**
- Modify: `packages/cli/src/components/theme.ts:22-30`

**Step 1: Add Gemini model colors**

In `packages/cli/src/components/theme.ts`, add Gemini entries to the `modelColors` map (after line 30, before the closing `}`):

```typescript
// Model color map — Claude = orange, OpenAI = purple, Gemini = Google brand colors
export const modelColors: Record<string, string> = {
  'Claude Opus':   '#DF561F',  // brand orange
  'Claude Sonnet': '#F08A5D',  // lighter orange
  'Claude Haiku':  '#F7B267',  // amber
  'GPT-5':         '#8B5CF6',  // purple
  'GPT-4o':        '#A78BFA',  // lighter purple
  'o3':            '#7C3AED',  // deeper purple
  'o4':            '#6D28D9',  // deep purple
  'Gemini 3.1 Pro':        '#4285F4',  // Google blue
  'Gemini 3.1 Flash Lite': '#00ACC1',  // cyan
  'Gemini 3 Flash':        '#009688',  // teal
  'Gemini 2.5 Pro':        '#3F51B5',  // indigo
  'Gemini 2.5 Flash':      '#34A853',  // Google green
  'Gemini 2.5 Flash Lite': '#8BC34A',  // light green
  'Gemini 2.0 Flash':      '#FBBC05',  // Google yellow
  'Gemini 2.0 Flash Lite': '#FF8F00',  // amber
};
```

**Step 2: Update `getModelColor` in ModelPalette.tsx**

In `packages/cli/src/components/ModelPalette.tsx`, update the `getModelColor` function (lines 41-51) to add a Gemini family matcher:

After line 47 (`if (/GPT/i.test(name)) return modelColors['GPT-5']!;`), add:

```typescript
// Gemini family → blue/green shades
if (/Gemini/i.test(name)) return modelColors['Gemini 2.5 Pro'] ?? modelFallback[0]!;
```

**Step 3: Run existing tests**

Run: `cd packages/cli && bun run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/cli/src/components/theme.ts packages/cli/src/components/ModelPalette.tsx
git commit -m "feat(cli): add Gemini model colors to CLI theme and palette"
```

---

### Task 5: Add Gemini models to `prettifyModel` (CLI + Web)

**Files:**
- Modify: `packages/cli/src/components/ModelPalette.tsx:13-30` (CLI prettifyModel)
- Modify: `apps/web/components/app/feed/ActivityCard.tsx:57-75` (Web prettifyModel)
- Modify: `apps/web/__tests__/unit/prettify-model.test.ts`

**Step 1: Add Gemini test cases**

In `apps/web/__tests__/unit/prettify-model.test.ts`, add a new describe block after the "OpenAI models" block:

```typescript
describe("Gemini models", () => {
  it("prettifies gemini-3.1-pro-preview", () => {
    expect(prettifyModel("gemini-3.1-pro-preview")).toBe("Gemini 3.1 Pro");
  });

  it("prettifies gemini-3.1-flash-lite-preview", () => {
    expect(prettifyModel("gemini-3.1-flash-lite-preview")).toBe("Gemini 3.1 Flash Lite");
  });

  it("prettifies gemini-3-flash-preview", () => {
    expect(prettifyModel("gemini-3-flash-preview")).toBe("Gemini 3 Flash");
  });

  it("prettifies gemini-2.5-pro", () => {
    expect(prettifyModel("gemini-2.5-pro")).toBe("Gemini 2.5 Pro");
  });

  it("prettifies gemini-2.5-flash", () => {
    expect(prettifyModel("gemini-2.5-flash")).toBe("Gemini 2.5 Flash");
  });

  it("prettifies gemini-2.5-flash-lite", () => {
    expect(prettifyModel("gemini-2.5-flash-lite")).toBe("Gemini 2.5 Flash Lite");
  });

  it("prettifies gemini-2.0-flash", () => {
    expect(prettifyModel("gemini-2.0-flash")).toBe("Gemini 2.0 Flash");
  });

  it("prettifies gemini-2.0-flash-lite", () => {
    expect(prettifyModel("gemini-2.0-flash-lite")).toBe("Gemini 2.0 Flash Lite");
  });
});
```

Also update the "unknown models" test that previously expected gemini models to pass through raw:

```typescript
it("returns the model name as-is for unrecognized models", () => {
  expect(prettifyModel("qwen-2.5-coder")).toBe("qwen-2.5-coder");
  expect(prettifyModel("mistral-large")).toBe("mistral-large");
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun run test -- prettify-model`
Expected: FAIL — Gemini models return raw string instead of pretty name.

**Step 3: Add Gemini matching to web prettifyModel**

In `apps/web/components/app/feed/ActivityCard.tsx`, add Gemini rules after line 69 (the `if (/^o3/i...)` line), before the legacy Claude matching:

```typescript
// Gemini family: "gemini-3.1-pro-preview" → "Gemini 3.1 Pro"
if (/^gemini-/i.test(normalized)) {
  return normalized
    .replace(/^gemini-/i, "Gemini ")
    .replace(/-preview$/, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
```

**Step 4: Add same Gemini matching to CLI prettifyModel**

In `packages/cli/src/components/ModelPalette.tsx`, add the same block after line 23 (the `if (/^o3/i...)` line):

```typescript
// Gemini family: "gemini-3.1-pro-preview" → "Gemini 3.1 Pro"
if (/^gemini-/i.test(normalized)) {
  return normalized
    .replace(/^gemini-/i, "Gemini ")
    .replace(/-preview$/, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
```

**Step 5: Run tests to verify they pass**

Run: `cd apps/web && bun run test -- prettify-model`
Expected: All tests PASS.

Run: `cd packages/cli && bun run test`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add apps/web/components/app/feed/ActivityCard.tsx packages/cli/src/components/ModelPalette.tsx apps/web/__tests__/unit/prettify-model.test.ts
git commit -m "feat: add Gemini model prettification to CLI and web"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/DECISIONS.md`

**Step 1: Add CHANGELOG entry**

Add under `## Unreleased / ### Added`:

```markdown
- **Gemini CLI usage tracking via gemistat.** The CLI now collects Gemini CLI usage data alongside Claude Code and Codex. Runs `gemistat daily --json` in parallel with ccusage and @ccusage/codex, merges all three sources by date, and submits combined stats. Silent failure — users without Gemini CLI or gemistat are unaffected. Gemini models (Gemini 3.1 Pro, 2.5 Pro/Flash, etc.) get dedicated colors in the CLI scorecard palette and pretty names in feed cards.
```

**Step 2: Add DECISIONS entry**

Add to `docs/DECISIONS.md`:

```markdown
## Gemini CLI Integration: gemistat Subprocess, Not Direct Telemetry Parsing (2026-04-04)

**Decision:** Integrate Gemini CLI usage tracking by running `gemistat` (by ryoppippi, same author as ccusage) as a subprocess, mirroring the existing ccusage/codex pattern. Silent failure for users without Gemini CLI.

**Why:**
- **Same author, same conventions.** gemistat outputs `{ daily: [...], totals: {...} }` with field names matching ccusage (`modelsUsed`, `totalCost`, `cacheReadTokens`). This means the parser is trivial.
- **Keeps the CLI thin.** gemistat handles telemetry parsing, pricing lookup (via LiteLLM), and daily aggregation. Replicating this in Straude would mean maintaining a Gemini pricing table and OpenTelemetry parser.
- **Proven pattern.** ccusage (fatal errors) and codex (silent errors) are battle-tested. Gemini follows the codex pattern — silent failure, so existing users are never affected.

**Alternatives considered:**
1. **Parse `~/.gemini/telemetry.log` directly** — Full control, no dependency, but requires maintaining a pricing table and OpenTelemetry parser. Telemetry must still be enabled manually.
2. **Parse chat session files (`~/.gemini/tmp/*/chats/*.json`)** — No telemetry enablement needed, but token data is less structured and harder to aggregate reliably.
3. **Hybrid (gemistat with fallback to direct parsing)** — More robust but doubles the code surface for marginal benefit.
```

**Step 3: Commit**

```bash
git add docs/CHANGELOG.md docs/DECISIONS.md
git commit -m "docs: add Gemini CLI integration changelog and decision record"
```

---

### Task 7: Run full test suite and typecheck

**Step 1: Run CLI tests**

Run: `cd packages/cli && bun run test`
Expected: All tests pass.

**Step 2: Run web tests**

Run: `cd apps/web && bun run test`
Expected: All tests pass.

**Step 3: Run typecheck**

Run: `cd apps/web && bun run typecheck`
Expected: No type errors.

**Step 4: Run build**

Run: `bun run build`
Expected: Build succeeds for both packages.
