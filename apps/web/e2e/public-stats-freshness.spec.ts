import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

// This suite changes the global LOCAL snapshot. Run with an exclusive DB lease,
// never alongside integration tests (their helpers truncate application tables).
const dbUrl = process.env.SUPABASE_TEST_DB_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const cronSecret = process.env.CRON_SECRET ?? "";
const seedPrefix = "a0000000-0000-4000-8000-";
const faultFunction = "public.stats_e2e_reject_snapshot_write";
const faultTrigger = "stats_e2e_reject_snapshot_write";

type Snapshot = { snapshot_date: string; captured_at: string; stats: Record<string, unknown> };
type Totals = {
  rows: number; tracked_users: number; total_users: number; total_spend: number;
  total_tokens: number; total_sessions: number; total_streaks: number;
  avg_streak: number; avg_weekly_spend: number; active_today: number;
};

function assertLoopback(value: string, label: string) {
  const hostname = new URL(value).hostname;
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname)) {
    throw new Error(`Refusing public-stats E2E against non-loopback ${label}`);
  }
}

async function snapshotRows(db: Client): Promise<Snapshot[]> {
  return (await db.query(`SELECT snapshot_date::text, captured_at::text, stats
    FROM public.open_stats_snapshots ORDER BY snapshot_date`)).rows;
}

async function latestSnapshot(db: Client): Promise<Snapshot> {
  const rows = await snapshotRows(db);
  expect(rows.length).toBeGreaterThan(0);
  return rows[rows.length - 1];
}

async function openPage(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} renders successfully`).toBe(200);
  expect(response?.headers()["content-security-policy"], "actual CSP is enabled").toBeTruthy();
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

async function expectCapture(page: Page, timestamp: string) {
  // PostgREST serializes timestamptz with +00:00; cron uses ISO's equivalent Z.
  await expect.poll(async () => Date.parse(await page.locator("main time[datetime]").getAttribute("datetime") ?? "")).toBe(Date.parse(timestamp));
}

async function attach(info: TestInfo, name: string, data: unknown) {
  await info.attach(name, { body: JSON.stringify(data, null, 2), contentType: "application/json" });
}

// The SQL oracle deliberately does not call the application's aggregation/RPCs.
const totalsSql = `WITH cohort AS (
  SELECT * FROM public.daily_usage WHERE user_id::text NOT LIKE 'a0000000-0000-4000-8000-%'
), dated AS (
  SELECT user_id, date, max(date) OVER (PARTITION BY user_id) AS latest,
    row_number() OVER (PARTITION BY user_id ORDER BY date DESC)::int AS ordinal
  FROM cohort
), latest_runs AS (
  SELECT user_id, count(*) AS days FROM dated WHERE date + ordinal = latest + 1 GROUP BY user_id
)
SELECT count(*)::int AS rows, count(DISTINCT user_id)::int AS tracked_users,
  (SELECT count(*)::int FROM public.users WHERE id::text NOT LIKE 'a0000000-0000-4000-8000-%') AS total_users,
  sum(cost_usd)::float8 AS total_spend, sum(total_tokens)::float8 AS total_tokens,
  sum(session_count)::float8 AS total_sessions,
  (SELECT sum(days)::float8 FROM latest_runs) AS total_streaks,
  (SELECT round(avg(days))::float8 FROM latest_runs) AS avg_streak,
  (sum(cost_usd) / count(DISTINCT user_id) / greatest(1, (max(date) - min(date)) / 7.0))::float8 AS avg_weekly_spend,
  count(DISTINCT user_id) FILTER (WHERE date = current_date)::int AS active_today FROM cohort`;

const concentrationSql = `WITH spend AS (
  SELECT user_id, sum(cost_usd) AS cost FROM public.daily_usage
  WHERE user_id::text NOT LIKE 'a0000000-0000-4000-8000-%' GROUP BY user_id
), ranked AS (
  SELECT *, row_number() OVER (ORDER BY cost DESC, user_id) AS rank, count(*) OVER () AS people FROM spend
), buckets AS (
  SELECT CASE WHEN rank <= ceil(people * .01) THEN 'top_1'
    WHEN rank <= ceil(people * .05) THEN 'top_5'
    WHEN rank <= ceil(people * .1) THEN 'top_10' ELSE 'rest' END AS segment, cost FROM ranked
)
SELECT segment, count(*)::int AS user_count, sum(cost)::float8 AS total_spend,
  round(sum(cost) / (SELECT sum(cost) FROM spend) * 100, 1)::float8 AS pct_of_total
FROM buckets GROUP BY segment ORDER BY segment`;

const modelsSql = `SELECT entry->>'model' AS model, sum((entry->>'cost_usd')::numeric)::float8 AS cost
FROM public.daily_usage d CROSS JOIN LATERAL jsonb_array_elements(d.model_breakdown) entry
WHERE d.user_id::text NOT LIKE 'a0000000-0000-4000-8000-%'
  AND (entry->>'cost_usd')::numeric > 0 GROUP BY entry->>'model' ORDER BY cost DESC`;

test.use({ bypassCSP: false, trace: "on" });

test.describe("public snapshot freshness (exclusive local database)", () => {
  test("reconciles paginated totals, refreshes warmed pages, and preserves stale or missing capture states", async ({ page, request }, info) => {
    // Playwright loads specs through CommonJS; production disables require(ESM).
    const [{ prettifyModel }, { formatTokens }] = await Promise.all([
      import("@straude/shared/models"),
      import("@straude/shared/format"),
    ]);
    test.setTimeout(180_000);
    test.skip(!apiUrl || !secretKey || !cronSecret, "Requires local Supabase and protected cron fixture environment.");
    assertLoopback(apiUrl, "Supabase API");
    assertLoopback(dbUrl, "Postgres");
    assertLoopback(String(info.project.use.baseURL), "app");
    const db = new Client({ connectionString: dbUrl });
    await db.connect();
    const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const ids: string[] = Array.from({ length: 102 }, () => randomUUID());
    const seedId = `${seedPrefix}${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    ids.push(seedId);
    const originals = await snapshotRows(db);
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const headers = { authorization: `Bearer ${cronSecret}` };
    const refresh = () => request.get("/api/cron/refresh-open-stats", { headers });
    let restored = false;
    let cleanupPageInvalidationStatus: number | null = null;

    try {
      await test.step("prepare synthetic local aggregate fixtures, including historical and private profiles", async () => {
        for (let start = 0; start < ids.length; start += 10) {
          await Promise.all(ids.slice(start, start + 10).map(async (id, offset) => {
            const result = await admin.auth.admin.createUser({
              id, email: `stats-${id}@local.test`, email_confirm: true,
              user_metadata: { user_name: `stats_${id.replaceAll("-", "").slice(-10)}` },
            });
            expect(result.error, "create synthetic Auth identity").toBeNull();
            await db.query("UPDATE public.users SET is_public = $2, onboarding_completed = true WHERE id = $1", [id, (start + offset) % 2 === 0]);
          }));
        }
        // 1005 consecutive historical days for one person crosses PostgREST's
        // 1000-row response cap; it must count as 1005 streak DAYS, not people.
        await db.query(`INSERT INTO public.daily_usage
          (user_id, date, cost_usd, input_tokens, output_tokens, total_tokens, session_count, models, model_breakdown)
          SELECT $1, current_date - 10 - i, 1.25, 1000, 500, 1500, 2,
            '["claude-sonnet-4","gpt-5.6"]'::jsonb,
            '[{"model":"claude-sonnet-4","cost_usd":1},{"model":"gpt-5.6","cost_usd":0.25}]'::jsonb
          FROM generate_series(0,1004) i`, [ids[0]]);
        await db.query(`INSERT INTO public.daily_usage
          (user_id, date, cost_usd, input_tokens, output_tokens, total_tokens, session_count, models, model_breakdown)
          SELECT fixture.id, current_date - fixture.age, fixture.cost, 2000, 1000, 3000, 3,
            '["gpt-5.6"]'::jsonb, jsonb_build_array(jsonb_build_object('model','gpt-5.6','cost_usd',fixture.cost))
          FROM jsonb_to_recordset($1::jsonb) fixture(id uuid, age int, cost numeric)`, [JSON.stringify([
          ...[1, 2, 4].map(age => ({ id: ids[1], age, cost: 2.5 })),
          ...[0, 1, 2].map(age => ({ id: ids[2], age, cost: 3.5 })),
          { id: ids[3], age: 100, cost: 4.5 },
          ...ids.slice(4, 101).map((id, index) => ({ id, age: 30, cost: index + 5.5 })),
          { id: seedId, age: 0, cost: 99_999 },
        ])]);
        const totalRows = Number((await db.query("SELECT count(*) AS count FROM public.daily_usage")).rows[0].count);
        expect(totalRows).toBeGreaterThan(1000);
        const capped = await admin.from("daily_usage").select("id", { count: "exact" }).range(0, 999);
        expect(capped.error).toBeNull();
        expect(capped.count).toBe(totalRows);
        expect(capped.data).toHaveLength(1000);
        await attach(info, "fixture-boundary", {
          syntheticAuthProfiles: ids.length, fixtureTrackedProfiles: 101, fixtureUnusedProfiles: 1,
          seedPrefix, totalRows, firstPageLength: capped.data?.length,
          scope: "local aggregate fixtures; accepted CLI collection is tested separately",
          streakCases: { historicalConsecutive: 1005, brokenLatestRun: 2, currentRun: 3, historicalSingleDay: 1 },
        });
      });

      const expected = (await db.query(totalsSql)).rows[0] as Totals;
      const expectedConcentration = (await db.query(concentrationSql)).rows;
      const modelCosts = new Map<string, number>();
      for (const row of (await db.query(modelsSql)).rows) {
        const name = prettifyModel(row.model);
        modelCosts.set(name, (modelCosts.get(name) ?? 0) + row.cost);
      }
      const modelCostTotal = [...modelCosts.values()].reduce((sum, cost) => sum + cost, 0);
      const expectedModels = [...modelCosts].sort((a, b) => b[1] - a[1]).map(([name, cost]) => ({ name, pct: Math.round(cost / modelCostTotal * 100) })).filter(row => row.pct > 0);
      await attach(info, "independent-sql-oracle", { totalsSql, concentrationSql, modelsSql, expected, expectedConcentration, expectedModels });
      expect(expected.tracked_users).toBeGreaterThan(100);
      expect(expected.total_streaks).toBeGreaterThan(expected.tracked_users);
      expect(expected.tracked_users).toBeGreaterThan(expected.active_today);

      await test.step("cron rejects missing or wrong authorization without changing snapshots", async () => {
        expect((await request.get("/api/cron/refresh-open-stats")).status()).toBe(401);
        expect((await request.get("/api/cron/refresh-open-stats", { headers: { authorization: "Bearer wrong-local-fixture-secret" } })).status()).toBe(401);
        expect(await snapshotRows(db)).toEqual(originals);
      });

      await test.step("missing snapshot renders unavailable without a fabricated date", async () => {
        // A successful protected request invalidates both pages. Removing its
        // local fixture snapshot BEFORE either page is read makes this repeatable
        // with production ISR as well as next dev; no test revalidation route.
        const response = await refresh();
        expect(response.status(), await response.text()).toBe(200);
        await db.query("DELETE FROM public.open_stats_snapshots");
        await openPage(page, "/open");
        await expect(page.getByRole("status")).toContainText("temporarily unavailable");
        await expect(page.locator("main time[datetime]")).toHaveCount(0);
        for (const label of ["Estimated Usage Cost", "Total Tokens", "Avg Latest Streak"]) {
          await expect(page.getByText(label, { exact: true }).locator("..")).toContainText("—");
        }
        const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
        expect(jsonLd.join(" ")).not.toContain('"@type":"FAQPage"');
        await capture(page, info, "open-unavailable");
        await openPage(page, "/");
        await expect(page.getByText("Sessions Logged", { exact: false }).first()).toContainText("---");
        await expect(page.getByText("Snapshot Captured", { exact: false })).toHaveCount(0);
        await capture(page, info, "landing-unavailable");
      });

      await test.step("protected refresh persists a real new capture and updates both warmed pages", async () => {
        const started = Date.now();
        const response = await refresh();
        expect(response.status(), await response.text()).toBe(200);
        const receipt = await response.json();
        const snapshot = await latestSnapshot(db);
        const captured = Date.parse(snapshot.captured_at);
        expect(captured).toBeGreaterThanOrEqual(started);
        expect(captured).toBeLessThanOrEqual(Date.now());
        expect(Date.parse(receipt.capturedAt)).toBe(captured);
        const stats = snapshot.stats;
        expect(stats.concentrationBasis).toBe("percentiles");
        for (const [field, sqlField] of Object.entries({
          trackedUsers: "tracked_users", totalUsers: "total_users", totalSpend: "total_spend",
          totalTokens: "total_tokens", totalSessions: "total_sessions", totalStreaks: "total_streaks",
          avgStreak: "avg_streak", avgWeeklySpend: "avg_weekly_spend",
        })) expect(Number(stats[field]), field).toBeCloseTo(Number(expected[sqlField as keyof Totals]), 7);
        const concentration = stats.concentration as Array<{ segment: string; user_count: number; total_spend: number; pct_of_total: number }>;
        expect([...concentration].sort((a, b) => a.segment.localeCompare(b.segment))).toEqual(expectedConcentration);
        expect(stats.models).toEqual(expectedModels);
        expect(concentration.find(row => row.segment === "top_1")?.user_count).toBe(Math.ceil(expected.tracked_users / 100));
        await attach(info, "fresh-snapshot-reconciliation", { receipt, snapshot, expected, expectedConcentration, expectedModels });
        await openPage(page, "/open");
        await expect(page.getByRole("status")).toContainText("latest successful snapshot");
        await expectCapture(page, receipt.capturedAt);
        await expect(page.getByText("Estimated Usage Cost", { exact: true }).locator("..")).toContainText(`$${Math.round(expected.total_spend).toLocaleString("en-US")}`);
        await expect(page.getByText("Total Tokens", { exact: true }).locator("..")).toContainText(formatTokens(expected.total_tokens));
        await expect(page.getByText("Avg Latest Streak", { exact: true }).locator("..")).toContainText(String(expected.avg_streak));
        await expect(page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Top 1%", exact: true }) })).toContainText(`${concentration.find(row => row.segment === "top_1")!.pct_of_total}%`);
        await capture(page, info, "open-fresh");
        await openPage(page, "/");
        await expect(page.getByText("Sessions Logged", { exact: false }).first()).toContainText(expected.total_sessions.toLocaleString("en-US"));
        await expect(page.getByText("Latest Streak Days", { exact: false }).first()).toContainText(expected.total_streaks.toLocaleString("en-US"));
        await expect(page.getByText("Snapshot Captured", { exact: false }).first()).toContainText(receipt.snapshotDate);
        await capture(page, info, "landing-fresh");
      });

      await test.step("local persistence fault returns 500 while retaining the actual 49-hour-old capture", async () => {
        const response = await refresh();
        expect(response.status()).toBe(200);
        const staleCapture = new Date(Date.now() - 49 * 3_600_000).toISOString();
        // Labeled LOCAL fixture edit after invalidation and before page reads.
        // Payload fetchedAt remains fresh, proving durable captured_at wins.
        await db.query("UPDATE public.open_stats_snapshots SET captured_at = $1", [staleCapture]);
        const staleRows = await snapshotRows(db);
        await openPage(page, "/open");
        await expect(page.getByRole("status")).toContainText("over 48 hours old");
        await expectCapture(page, staleCapture);
        await capture(page, info, "open-stale-before-failure");
        await openPage(page, "/");
        await expect(page.getByText("Snapshot Stale (>48h)", { exact: false }).first()).toContainText(staleCapture.slice(0, 10));
        await db.query(`CREATE FUNCTION ${faultFunction}() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'LOCAL E2E INJECTED snapshot persistence failure'; END $$`);
        await db.query(`CREATE TRIGGER ${faultTrigger} BEFORE INSERT OR UPDATE ON public.open_stats_snapshots
          FOR EACH ROW EXECUTE FUNCTION ${faultFunction}()`);
        const failed = await refresh();
        expect(failed.status()).toBe(500);
        const failureBody = await failed.json();
        expect(failureBody.error).toContain("LOCAL E2E INJECTED snapshot persistence failure");
        expect(failureBody).not.toHaveProperty("capturedAt");
        expect(await snapshotRows(db)).toEqual(staleRows);
        await openPage(page, "/open");
        await expect(page.getByRole("status")).toContainText("last successful capture");
        await expectCapture(page, staleCapture);
        await capture(page, info, "open-stale-after-failed-refresh");
        await attach(info, "local-fault-injection", { boundary: "local PostgreSQL BEFORE INSERT OR UPDATE rejection trigger only", status: failed.status(), failureBody, preservedCapture: staleCapture, snapshotUnchanged: true });
        await db.query(`DROP TRIGGER ${faultTrigger} ON public.open_stats_snapshots`);
        await db.query(`DROP FUNCTION ${faultFunction}()`);
        const recovered = await refresh();
        expect(recovered.status()).toBe(200);
        expect(Date.parse((await latestSnapshot(db)).captured_at)).toBeGreaterThan(Date.parse(staleCapture));
        await openPage(page, "/open");
        await expect(page.getByRole("status")).toContainText("latest successful snapshot");
        await capture(page, info, "open-recovered");
      });
      expect(pageErrors).toEqual([]);
    } finally {
      // Restore exact pre-run durable snapshots and remove only generated IDs.
      // No global truncate, production call, or persistent fault injection.
      try {
        await db.query(`DROP TRIGGER IF EXISTS ${faultTrigger} ON public.open_stats_snapshots`);
        await db.query(`DROP FUNCTION IF EXISTS ${faultFunction}()`);
        // Mark both page caches for their next read before restoring rows. This
        // final local refresh is discarded with the other fixture snapshots.
        try {
          cleanupPageInvalidationStatus = (await refresh()).status();
        } catch {
          // An unavailable app must not prevent database/identity restoration.
        }
        await db.query("BEGIN");
        await db.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [ids]);
        await db.query("DELETE FROM public.open_stats_snapshots");
        await db.query(`INSERT INTO public.open_stats_snapshots (snapshot_date, captured_at, stats)
          SELECT snapshot_date, captured_at, stats FROM jsonb_to_recordset($1::jsonb)
          AS original(snapshot_date date, captured_at timestamptz, stats jsonb)`, [JSON.stringify(originals)]);
        await db.query("COMMIT");
        expect(await snapshotRows(db)).toEqual(originals);
        expect(Number((await db.query("SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])", [ids])).rows[0].count)).toBe(0);
        expect((await db.query("SELECT count(*) FROM pg_trigger WHERE tgname = $1", [faultTrigger])).rows[0].count).toBe("0");
        restored = true;
      } finally {
        await attach(info, "fixture-cleanup", { restoredOriginalSnapshots: restored, syntheticIdentitiesRemoved: restored, localFaultTriggerRemoved: restored, cleanupPageInvalidationStatus });
        await db.end();
      }
    }
  });
});
