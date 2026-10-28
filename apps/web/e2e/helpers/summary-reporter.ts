import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Retain outcomes and skip reasons without trace bodies, credentials or errors. */
export default class SummaryReporter implements Reporter {
  private outputDir = "test-results";
  private tests = new Map<string, { test: TestCase; attempts: { status: string; retry: number; duration_ms: number }[] }>();

  onBegin(config: FullConfig) {
    this.outputDir = config.projects[0]?.outputDir ?? this.outputDir;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const entry = this.tests.get(test.id) ?? { test, attempts: [] };
    entry.attempts.push({ status: result.status, retry: result.retry, duration_ms: result.duration });
    this.tests.set(test.id, entry);
  }

  async onEnd(result: FullResult) {
    const tests = [...this.tests.values()].map(({ test, attempts }) => ({
      title: test.titlePath(),
      location: test.location,
      expected_status: test.expectedStatus,
      outcome: test.outcome(),
      annotations: test.annotations.filter(({ type }) => type === "skip" || type === "fixme"),
      attempts,
    }));
    await mkdir(this.outputDir, { recursive: true });
    await writeFile(join(this.outputDir, "runtime-summary.evidence.json"), JSON.stringify({
      source_commit: process.env.GITHUB_SHA ?? null,
      node: process.version,
      status: result.status,
      duration_ms: result.duration,
      counts: {
        passed: tests.filter(test => test.outcome === "expected").length,
        failed: tests.filter(test => test.outcome === "unexpected").length,
        skipped: tests.filter(test => test.outcome === "skipped").length,
        flaky: tests.filter(test => test.outcome === "flaky").length,
      },
      tests,
    }, null, 2) + "\n", { mode: 0o600 });
  }
}
