import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RESULTS_DIR } from "./env";

export const TTFB_TARGET_MS = 300;
export const LCP_TARGET_MS = 500;
export const RUNS = 5;

export type RunMetrics = {
  ttfb: number;
  fcp: number | null;
  lcp: number | null;
  serverTiming: { name: string; dur: number }[];
  layoutTiming: Record<string, number> | null;
};

export type PageResult = {
  path: string;
  ttfb: number;
  fcp: number | null;
  lcp: number | null;
  serverTiming: Record<string, number>;
  layoutTiming: Record<string, number>;
  runs: RunMetrics[];
  pass: boolean;
};

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("Cannot calculate the median of an empty sample");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function medianNullable(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value != null);
  return present.length === 0 ? null : median(present);
}

function medianRecord(
  runs: RunMetrics[],
  select: (run: RunMetrics) => Record<string, number> | null
): Record<string, number> {
  const samples = new Map<string, number[]>();
  for (const run of runs) {
    for (const [name, duration] of Object.entries(select(run) ?? {})) {
      samples.set(name, [...(samples.get(name) ?? []), duration]);
    }
  }
  return Object.fromEntries(
    [...samples].map(([name, durations]) => [name, median(durations)])
  );
}

function medianServerTiming(runs: RunMetrics[]): Record<string, number> {
  const samples = new Map<string, number[]>();
  for (const run of runs) {
    for (const { name, dur } of run.serverTiming) {
      samples.set(name, [...(samples.get(name) ?? []), dur]);
    }
  }
  return Object.fromEntries(
    [...samples].map(([name, durations]) => [name, median(durations)])
  );
}

export function summarizePage(
  pagePath: string,
  runs: RunMetrics[]
): PageResult {
  const warm = runs.slice(1);
  const ttfb = median(warm.map((run) => run.ttfb));
  const fcp = medianNullable(warm.map((run) => run.fcp));
  const lcp = medianNullable(warm.map((run) => run.lcp));

  return {
    path: pagePath,
    ttfb,
    fcp,
    lcp,
    serverTiming: medianServerTiming(warm),
    layoutTiming: medianRecord(warm, (run) => run.layoutTiming),
    runs,
    pass: ttfb < TTFB_TARGET_MS && lcp != null && lcp < LCP_TARGET_MS,
  };
}

export function writeScorecard(
  results: PageResult[],
  rightSidebarMs: number | null,
  gate: boolean
): void {
  if (results.length === 0) throw new Error("No page measurements were recorded");

  mkdirSync(RESULTS_DIR, { recursive: true });
  const date = new Date().toISOString();
  const scorecard = {
    date,
    targets: { ttfbMs: TTFB_TARGET_MS, lcpMs: LCP_TARGET_MS },
    sample: { runs: RUNS, warmRuns: RUNS - 1, discardedRuns: 1 },
    gate,
    rightSidebarMs,
    pages: results.map(({ runs: _runs, ...result }) => result),
  };
  writeFileSync(
    path.join(RESULTS_DIR, "scorecard.json"),
    JSON.stringify({ ...scorecard, raw: results }, null, 2)
  );

  const format = (value: number | null) =>
    value == null ? "n/a" : `${value.toFixed(0)}ms`;
  const lines = [
    `# Perf scorecard - ${date}`,
    "",
    `Targets: TTFB < ${TTFB_TARGET_MS}ms, LCP < ${LCP_TARGET_MS}ms (median of ${RUNS - 1} warm runs after discarding run 1, local production build)`,
    "",
    "| Page | TTFB | FCP | LCP | Server-Timing | Layout attribution | Pass |",
    "|---|---:|---:|---:|---|---|:---:|",
    ...results.map((result) => {
      const serverTiming = Object.entries(result.serverTiming)
        .map(([name, duration]) => `${name}:${duration.toFixed(0)}ms`)
        .join(" ");
      const layoutTiming = Object.entries(result.layoutTiming)
        .map(([name, duration]) => `${name}:${duration.toFixed(0)}ms`)
        .join(" ");
      return `| ${result.path} | ${format(result.ttfb)} | ${format(result.fcp)} | ${format(result.lcp)} | ${serverTiming || "n/a"} | ${layoutTiming || "n/a"} | ${result.pass ? "PASS" : "FAIL"} |`;
    }),
    "",
    `Right sidebar API: ${format(rightSidebarMs)}`,
    "",
    `${results.filter((result) => result.pass).length}/${results.length} pages passing`,
    "",
  ];
  writeFileSync(path.join(RESULTS_DIR, "scorecard.md"), lines.join("\n"));
  console.log(`\nScorecard written to perf-results/scorecard.md\n`);
  console.log(lines.join("\n"));

  if (gate) {
    const failures = results.filter((result) => !result.pass);
    if (failures.length > 0) {
      throw new Error(
        `Performance gate failed: ${failures.map((result) => result.path).join(", ")}`
      );
    }
  }
}
