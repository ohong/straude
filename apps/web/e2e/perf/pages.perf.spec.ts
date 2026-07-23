import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { TARGETS_PATH } from "./env";
import {
  RUNS,
  median,
  summarizePage,
  writeScorecard,
  type PageResult,
  type RunMetrics,
} from "./scorecard";

// Targets from docs/perf/PLAN.md (user-approved definition of done).
const GATE = process.env.PERF_GATE === "1";

type Targets = { profileUsername: string; postId: string };

function targets(): Targets {
  return JSON.parse(readFileSync(TARGETS_PATH, "utf8"));
}

const PAGES: { name: string; path: (t: Targets) => string }[] = [
  { name: "/feed", path: () => "/feed" },
  { name: "/leaderboard", path: () => "/leaderboard" },
  { name: "/u/[username]", path: (t) => `/u/${encodeURIComponent(t.profileUsername)}` },
  { name: "/post/[id]", path: (t) => `/post/${encodeURIComponent(t.postId)}` },
  { name: "/notifications", path: () => "/notifications" },
  { name: "/messages", path: () => "/messages" },
  { name: "/prompts", path: () => "/prompts" },
  { name: "/recap", path: () => "/recap" },
  { name: "/settings", path: () => "/settings" },
  { name: "/search", path: () => "/search" },
];

const results: PageResult[] = [];
let rightSidebarMs: number | null = null;

async function measureRun(page: Page, url: string): Promise<RunMetrics> {
  await page.goto(url, { waitUntil: "load" });
  return page.evaluate(async () => {
    const nav = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;
    const fcp =
      performance.getEntriesByName("first-contentful-paint")[0]?.startTime ??
      null;
    const lcp = await new Promise<number | null>((resolve) => {
      let last: number | null = null;
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) last = entry.startTime;
      });
      po.observe({ type: "largest-contentful-paint", buffered: true });
      // allow late LCP candidates (client-fetched content) to land
      setTimeout(() => {
        po.disconnect();
        resolve(last);
      }, 1500);
    });
    const layoutEl = document.getElementById("__perf-server-timing");
    return {
      ttfb: nav.responseStart,
      fcp,
      lcp,
      serverTiming: (nav.serverTiming ?? []).map((s) => ({
        name: s.name,
        dur: s.duration,
      })),
      layoutTiming: layoutEl ? JSON.parse(layoutEl.textContent || "{}") : null,
    };
  });
}

for (const target of PAGES) {
  test(`perf ${target.name}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      storageState: "e2e/perf/.auth/storage-state.json",
    });
    const url = `${baseURL}${target.path(targets())}`;

    const runs: RunMetrics[] = [];
    for (let i = 0; i < RUNS; i++) {
      const page = await context.newPage();
      runs.push(await measureRun(page, url));
      await page.close();
    }
    await context.close();

    const result = summarizePage(target.name, runs);
    results.push(result);

    // LCP must exist: a page whose LCP never fires is a bug in the harness,
    // not a pass. (Recorded above so the scorecard still includes the page.)
    expect(result.lcp, `${target.name}: no LCP entry recorded`).not.toBeNull();
  });
}

test("perf /api/app/right-sidebar (informational)", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    storageState: "e2e/perf/.auth/storage-state.json",
  });
  const durations: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = Date.now();
    const res = await context.request.get(`${baseURL}/api/app/right-sidebar`);
    expect(res.ok()).toBeTruthy();
    durations.push(Date.now() - start);
  }
  await context.close();
  rightSidebarMs = median(durations.slice(1));
});

test.afterAll(() => writeScorecard(results, rightSidebarMs, GATE));
