import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool, type Client } from "pg";
import { openTestDb, cleanDb, insertUser } from "./db";

/**
 * Real-stack integration test for POST /api/usage/submit.
 *
 * Compared to __tests__/api/usage-submit.test.ts (which mocks the Supabase
 * client, the auth helper, and every chained query), this test:
 *
 *   - Runs against a real Postgres with the full migration history applied
 *     (whatever `bunx supabase start` boots).
 *   - Exercises the real `verifyCliTokenWithRefresh` against a real signed
 *     JWT we mint with `createCliToken`.
 *   - Calls the route's exported `POST` handler with a real Request.
 *   - Asserts on rows the handler actually wrote to Postgres, not on the
 *     shape of our mock calls.
 *
 * What this catches that the mock test cannot:
 *   - Missing columns / column-type mismatches (the bug class behind the
 *     "collector_meta column not in schema cache" incident).
 *   - Real CHECK constraints rejecting bad data (negative cost, etc.).
 *   - FK + cascade behavior when one route writes to several tables.
 *   - Real numeric precision (Postgres NUMERIC → JS number roundtrip).
 *   - JWT signing/verification end-to-end (a stale signing secret would
 *     break this; the mock test would happily pass).
 */

let db: Client;

beforeAll(async () => {
  db = await openTestDb();
});

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await cleanDb(db);
});

async function mintCliToken(userId: string, username: string): Promise<string> {
  // Import after globalSetup has populated CLI_JWT_SECRET on the env.
  const { createCliToken } = await import("@/lib/api/cli-auth");
  return createCliToken(userId, username);
}

async function callSubmit(
  body: unknown,
  token: string,
): Promise<Response> {
  // Same dynamic-import-after-env trick: the route module captures
  // SUPABASE_SECRET_KEY at first import, so we have to wait until
  // global-setup.ts has set it.
  const { POST } = await import("@/app/api/usage/submit/route");
  const req = new Request("http://localhost/api/usage/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return POST(req);
}

const DEVICE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const today = new Date().toISOString().slice(0, 10);

function v2Agent(overrides: Record<string, unknown> = {}) {
  return {
    agent: "codex",
    models: ["gpt-5.6"],
    input_tokens: 100,
    output_tokens: 20,
    reasoning_output_tokens: 10,
    cache_creation_tokens: 0,
    cache_read_tokens: 30,
    total_tokens: 160,
    cost_usd: 0.25,
    model_breakdown: [{
      model: "gpt-5.6",
      input_tokens: 100,
      output_tokens: 20,
      reasoning_output_tokens: 10,
      cache_creation_tokens: 0,
      cache_read_tokens: 30,
      total_tokens: 160,
      cost_usd: 0.25,
    }],
    ...overrides,
  };
}

function v2Body(
  requestId: string,
  contentHash: string,
  overrides: Record<string, unknown> = {},
  collectorVersion = "20.0.26",
) {
  return {
    protocol_version: 2,
    request_id: requestId,
    source: "cli",
    timezone: "UTC",
    installation: { id: DEVICE_ID, name: "integration-device" },
    collector: { name: "ccusage", version: collectorVersion, pricing_mode: "online" },
    entries: [{
      date: today,
      content_hash: contentHash,
      agents: [v2Agent()],
      ...overrides,
    }],
  };
}

type ExpectedSource = {
  agent: string;
  total_tokens: number;
  cost_usd: number;
  version: string;
  device_id?: string;
};

/** Reconcile persisted source counters through each device and the public day. */
async function expectAccounting(
  userId: string,
  expected: ExpectedSource[],
  date = today,
) {
  const counters = [
    "input_tokens", "output_tokens", "reasoning_output_tokens",
    "cache_creation_tokens", "cache_read_tokens", "total_tokens",
  ] as const;
  const columns = [...counters, "cost_usd"].join(", ");
  const sources = await db.query(
    `SELECT device_id, agent, collector ->> 'version' AS version, ${columns}
     FROM public.usage_agent_daily WHERE user_id = $1 AND date = $2
     ORDER BY device_id, agent`,
    [userId, date],
  );
  expect(sources.rows.map((row) => ({
    device_id: row.device_id,
    agent: row.agent,
    total_tokens: Number(row.total_tokens),
    cost_usd: Number(row.cost_usd),
    version: row.version,
  }))).toEqual(expected.map((row) => ({ device_id: DEVICE_ID, ...row })).sort(
    (a, b) => a.device_id.localeCompare(b.device_id) || a.agent.localeCompare(b.agent),
  ));

  const devices = await db.query(
    `SELECT device_id, ${columns} FROM public.device_usage
     WHERE user_id = $1 AND date = $2 ORDER BY device_id`,
    [userId, date],
  );
  expect(devices.rows.map((row) => row.device_id)).toEqual(
    [...new Set(sources.rows.map((row) => row.device_id))].sort(),
  );
  for (const device of devices.rows) {
    const deviceSources = sources.rows.filter((row) => row.device_id === device.device_id);
    for (const counter of counters) {
      expect(Number(device[counter]), `device ${device.device_id} ${counter}`).toBe(
        deviceSources.reduce((sum, row) => sum + Number(row[counter]), 0),
      );
    }
    expect(Number(device.cost_usd)).toBeCloseTo(
      deviceSources.reduce((sum, row) => sum + Number(row.cost_usd), 0), 6,
    );
  }
  const daily = await db.query(
    `SELECT ${columns} FROM public.daily_usage WHERE user_id = $1 AND date = $2`,
    [userId, date],
  );
  expect(daily.rows).toHaveLength(1);
  for (const counter of counters) {
    expect(Number(daily.rows[0][counter]), `daily ${counter}`).toBe(
      devices.rows.reduce((sum, row) => sum + Number(row[counter]), 0),
    );
  }
  expect(Number(daily.rows[0].cost_usd)).toBeCloseTo(
    devices.rows.reduce((sum, row) => sum + Number(row.cost_usd), 0), 6,
  );
  const posts = await db.query(
    `SELECT post.id FROM public.posts AS post
     JOIN public.daily_usage AS daily ON daily.id = post.daily_usage_id
     WHERE daily.user_id = $1 AND daily.date = $2`,
    [userId, date],
  );
  expect(posts.rows).toHaveLength(1);
}

describe("POST /api/usage/submit (real Supabase)", () => {
  it("commits v2 per-agent rows and derives device and daily aggregates", async () => {
    const userId = await insertUser(db, { username: "v2_integration" });
    const token = await mintCliToken(userId, "v2_integration");

    const res = await callSubmit(v2Body("v2-commit", "a".repeat(64)), token);
    const json = await res.json();

    expect(res.status, JSON.stringify(json)).toBe(200);
    expect(json).toMatchObject({
      request_id: "v2-commit",
      outcomes: [{
        date: today,
        status: "committed",
        result: { action: "created" },
      }],
    });
    const agents = await db.query(
      `SELECT agent, input_tokens, reasoning_output_tokens, total_tokens, cost_usd, model_breakdown
       FROM public.usage_agent_daily
       WHERE user_id = $1 AND date = $2 AND device_id = $3`,
      [userId, today, DEVICE_ID],
    );
    expect(agents.rows).toHaveLength(1);
    expect(agents.rows[0].agent).toBe("codex");
    expect(Number(agents.rows[0].total_tokens)).toBe(160);
    expect(agents.rows[0].model_breakdown[0]).toMatchObject({
      model: "gpt-5.6",
      reasoning_output_tokens: 10,
    });
    const daily = await db.query(
      `SELECT cost_usd, total_tokens FROM public.daily_usage WHERE user_id = $1 AND date = $2`,
      [userId, today],
    );
    expect(Number(daily.rows[0].cost_usd)).toBeCloseTo(0.25, 6);
    expect(Number(daily.rows[0].total_tokens)).toBe(160);
  });

  it("preserves a user-edited generated title when usage is resynced", async () => {
    const userId = await insertUser(db, { username: "v2_custom_title" });
    const token = await mintCliToken(userId, "v2_custom_title");
    await callSubmit(v2Body("title-before", "a".repeat(64)), token);
    const generated = await db.query("SELECT usage_generated_title FROM public.posts WHERE user_id = $1", [userId]);
    expect(generated.rows[0].usage_generated_title).toBe(true);
    // PATCH /api/posts/[id] writes these fields together (covered by its API test).
    await db.query("UPDATE public.posts SET title = $2, usage_generated_title = false WHERE user_id = $1", [userId, "Sep 4 — My launch notes"]);
    await callSubmit(v2Body("title-after", "b".repeat(64)), token);
    const post = await db.query("SELECT title, usage_generated_title FROM public.posts WHERE user_id = $1", [userId]);
    expect(post.rows).toEqual([{ title: "Sep 4 — My launch notes", usage_generated_title: false }]);
  });

  it("replays identical request/date/content as unchanged without duplicate rows", async () => {
    const userId = await insertUser(db, { username: "v2_replay" });
    const token = await mintCliToken(userId, "v2_replay");
    const body = v2Body("v2-replay", "b".repeat(64));

    const first = await callSubmit(body, token);
    await db.query(
      `INSERT INTO public.usage_device_reconciliation_candidates (
         user_id, device_id_a, device_id_b, normalized_hostname, status
       ) VALUES ($1, $2, 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'integration-device', 'ambiguous')`,
      [userId, DEVICE_ID],
    );
    const second = await callSubmit(body, token);
    const secondJson = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondJson.outcomes[0].status).toBe("unchanged");
    const counts = await db.query(
      `SELECT
         (SELECT count(*)::int FROM public.usage_submission_outcomes WHERE user_id = $1) AS outcomes,
         (SELECT count(*)::int FROM public.usage_agent_daily WHERE user_id = $1) AS agents,
         (SELECT count(*)::int FROM public.daily_usage WHERE user_id = $1) AS daily`,
      [userId],
    );
    expect(counts.rows[0]).toEqual({ outcomes: 1, agents: 1, daily: 1 });
  });

  it("serializes 50 concurrent replays into one exact aggregate and one post", async () => {
    const userId = await insertUser(db, { username: "v2_concurrent" });
    const entry = v2Body("v2-concurrent", "9".repeat(64)).entries[0]!;
    const pool = new Pool({
      connectionString: process.env.TEST_DB_URL,
      max: 50,
    });
    try {
      const outcomes = await Promise.all(
        Array.from({ length: 50 }, () => pool.query<{ outcome: { status: string } }>(
          `SELECT public.submit_usage_day_v2(
             $1::uuid,
             'v2-concurrent',
             'cli',
             'UTC',
             $2::jsonb,
             $3::jsonb,
             $4::jsonb,
             $5,
             true
           ) AS outcome`,
          [
            userId,
            JSON.stringify({ id: DEVICE_ID, name: "concurrent-device" }),
            JSON.stringify({ name: "ccusage", version: "20.0.26", pricing_mode: "online" }),
            JSON.stringify(entry),
            "9".repeat(64),
          ],
        )),
      );
      const statuses = outcomes.map((result) => result.rows[0]!.outcome.status);
      expect(statuses.filter((status) => status === "committed")).toHaveLength(1);
      expect(statuses.filter((status) => status === "unchanged")).toHaveLength(49);
    } finally {
      await pool.end();
    }

    const exact = await db.query(
      `SELECT
         (SELECT count(*)::int FROM public.usage_submission_outcomes WHERE user_id = $1) AS outcomes,
         (SELECT count(*)::int FROM public.usage_agent_daily WHERE user_id = $1) AS agents,
         (SELECT count(*)::int FROM public.device_usage WHERE user_id = $1) AS devices,
         (SELECT count(*)::int FROM public.daily_usage WHERE user_id = $1) AS daily,
         (SELECT count(*)::int FROM public.posts WHERE user_id = $1) AS posts,
         (SELECT total_tokens::int FROM public.daily_usage WHERE user_id = $1) AS total_tokens`,
      [userId],
    );
    expect(exact.rows[0]).toEqual({
      outcomes: 1,
      agents: 1,
      devices: 1,
      daily: 1,
      posts: 1,
      total_tokens: 160,
    });
  });

  it("isolates the legacy shared web-import device id per user", async () => {
    const firstUserId = await insertUser(db, { username: "web_import_one" });
    const secondUserId = await insertUser(db, { username: "web_import_two" });
    const sharedWebId = "00000000-0000-0000-0000-000000000001";
    const entry = v2Body("unused", "7".repeat(64)).entries[0]!;

    for (const [userId, requestId] of [
      [firstUserId, "web-import-one"],
      [secondUserId, "web-import-two"],
    ]) {
      const result = await db.query<{ outcome: { status: string } }>(
        `SELECT public.submit_usage_day_v2(
           $1::uuid,
           $2,
           'web',
           'UTC',
           $3::jsonb,
           $4::jsonb,
           $5::jsonb,
           $6,
           false
         ) AS outcome`,
        [
          userId,
          requestId,
          JSON.stringify({ id: sharedWebId, name: "web-import" }),
          JSON.stringify({ name: "legacy-web-import", version: "1", pricing_mode: "online" }),
          JSON.stringify(entry),
          "7".repeat(64),
        ],
      );
      expect(result.rows[0]!.outcome.status).toBe("committed");
    }

    const devices = await db.query(
      `SELECT user_id, device_id
       FROM public.device_usage
       WHERE user_id = ANY($1::uuid[])
       ORDER BY user_id`,
      [[firstUserId, secondUserId]],
    );
    expect(devices.rows).toHaveLength(2);
    expect(new Set(devices.rows.map((row) => row.user_id)).size).toBe(2);
    expect(devices.rows.every((row) => row.device_id === sharedWebId)).toBe(true);
  });

  it("repairs a proof-eligible historical duplicate and rolls the batch back exactly", async () => {
    const userId = await insertUser(db, { username: "v2_repair" });
    const deviceA = "10000000-0000-4000-8000-000000000001";
    const deviceB = "20000000-0000-4000-8000-000000000002";
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const dates = [yesterday, today];

    await db.query(
      `INSERT INTO public.usage_installation_aliases (
         device_id, user_id, canonical_device_id, name, created_at, updated_at
       ) VALUES
         ($2, $1, $2, 'same-host', now() - interval '2 days', now() - interval '2 days'),
         ($3, $1, $3, 'same-host', now() - interval '1 day', now() - interval '1 day')`,
      [userId, deviceA, deviceB],
    );
    await db.query(
      `INSERT INTO public.usage_agent_daily (
         user_id, date, device_id, agent, models, input_tokens, output_tokens,
         reasoning_output_tokens, cache_creation_tokens, cache_read_tokens,
         total_tokens, cost_usd, model_breakdown, content_hash, collector
       )
       SELECT
         $1, day, device, 'codex', ARRAY['gpt-5.6'], 100, 20, 10, 0, 30,
         160, 0.25,
         jsonb_build_array(jsonb_build_object(
           'model', 'gpt-5.6', 'input_tokens', 100, 'output_tokens', 20,
           'reasoning_output_tokens', 10, 'cache_creation_tokens', 0,
           'cache_read_tokens', 30, 'total_tokens', 160, 'cost_usd', 0.25
         )),
         repeat('a', 64),
         '{"name":"ccusage","version":"20.0.26","pricing_mode":"online"}'::jsonb
       FROM unnest($2::date[]) AS day
       CROSS JOIN unnest($3::uuid[]) AS device`,
      [userId, dates, [deviceA, deviceB]],
    );
    await db.query(
      `INSERT INTO public.device_usage (
         user_id, date, device_id, device_name, cost_usd, input_tokens,
         output_tokens, reasoning_output_tokens, cache_creation_tokens,
         cache_read_tokens, total_tokens, models, model_breakdown,
         session_count, raw_hash, collector_meta
       )
       SELECT
         $1, day, device, 'same-host', 0.25, 100, 20, 10, 0, 30, 160,
         '["gpt-5.6"]'::jsonb,
         '[{"model":"gpt-5.6","cost_usd":0.25}]'::jsonb,
         1, repeat('a', 64),
         '{"name":"ccusage","version":"20.0.26","pricing_mode":"online"}'::jsonb
       FROM unnest($2::date[]) AS day
       CROSS JOIN unnest($3::uuid[]) AS device`,
      [userId, dates, [deviceA, deviceB]],
    );
    const daily = await db.query<{ id: string; date: string }>(
      `INSERT INTO public.daily_usage (
         user_id, date, cost_usd, input_tokens, output_tokens,
         reasoning_output_tokens, cache_creation_tokens, cache_read_tokens,
         total_tokens, models, model_breakdown, session_count, is_verified
       )
       SELECT
         $1, day, 0.50, 200, 40, 20, 0, 60, 320,
         '["gpt-5.6"]'::jsonb,
         '[{"model":"gpt-5.6","cost_usd":0.50}]'::jsonb,
         2, true
       FROM unnest($2::date[]) AS day
       RETURNING id, date::text`,
      [userId, dates],
    );
    for (const row of daily.rows) {
      const generated = row.date === today;
      await db.query(
        `INSERT INTO public.posts (
           user_id, daily_usage_id, title, usage_generated_title
         ) VALUES (
           $1, $2,
           CASE WHEN $3 THEN to_char($4::date, 'Mon FMDD') || ', $0.50'
                ELSE 'Keep this custom title' END,
           $3
         )`,
        [userId, row.id, generated, row.date],
      );
    }

    await db.query("SELECT public.discover_usage_device_candidates($1)", [userId]);
    const candidateBefore = await db.query(
      `SELECT id, status, overlap_dates, divergent_dates
       FROM public.usage_device_reconciliation_candidates
       WHERE user_id = $1`,
      [userId],
    );
    expect(candidateBefore.rows).toHaveLength(1);
    expect(candidateBefore.rows[0]).toMatchObject({
      status: "proof_merge",
      divergent_dates: [],
    });
    expect(candidateBefore.rows[0].overlap_dates).toHaveLength(2);

    const started = await db.query<{ id: string }>(
      "SELECT public.start_usage_repair_batch('integration rollback proof') AS id",
    );
    const batchId = started.rows[0]!.id;
    const run = await db.query<{ result: { complete: boolean } }>(
      "SELECT public.run_usage_repair_batch($1, 25) AS result",
      [batchId],
    );
    expect(run.rows[0]!.result.complete).toBe(true);

    const repaired = await db.query(
      `SELECT
         (SELECT count(*)::int FROM public.device_usage WHERE user_id = $1) AS devices,
         (SELECT count(*)::int FROM public.usage_agent_daily WHERE user_id = $1) AS agents,
         (SELECT bool_and(cost_usd = 0.25) FROM public.daily_usage WHERE user_id = $1) AS exact_daily,
         (SELECT count(*)::int FROM public.usage_installation_aliases
          WHERE user_id = $1 AND canonical_device_id = $2) AS canonical_aliases,
         (SELECT title FROM public.posts AS post
          JOIN public.daily_usage AS daily ON daily.id = post.daily_usage_id
          WHERE daily.user_id = $1 AND post.usage_generated_title) AS generated_title,
         (SELECT title FROM public.posts AS post
          JOIN public.daily_usage AS daily ON daily.id = post.daily_usage_id
          WHERE daily.user_id = $1 AND NOT post.usage_generated_title) AS custom_title`,
      [userId, deviceA],
    );
    expect(repaired.rows[0]).toMatchObject({
      devices: 2,
      agents: 2,
      exact_daily: true,
      canonical_aliases: 2,
      generated_title: expect.stringContaining("$0.25"),
      custom_title: "Keep this custom title",
    });

    await db.query("SELECT public.rollback_usage_repair_batch($1)", [batchId]);
    const restored = await db.query(
      `SELECT
         (SELECT count(*)::int FROM public.device_usage WHERE user_id = $1) AS devices,
         (SELECT count(*)::int FROM public.usage_agent_daily WHERE user_id = $1) AS agents,
         (SELECT bool_and(cost_usd = 0.50) FROM public.daily_usage WHERE user_id = $1) AS exact_daily,
         (SELECT count(*)::int FROM public.usage_installation_aliases
          WHERE user_id = $1 AND canonical_device_id = device_id) AS separate_aliases,
         (SELECT status FROM public.usage_device_reconciliation_candidates
          WHERE user_id = $1) AS candidate_status,
         (SELECT count(*)::int FROM public.usage_device_reconciliation_decisions
          WHERE user_id = $1) AS decisions,
         (SELECT title FROM public.posts AS post
          JOIN public.daily_usage AS daily ON daily.id = post.daily_usage_id
          WHERE daily.user_id = $1 AND post.usage_generated_title) AS generated_title,
         (SELECT title FROM public.posts AS post
          JOIN public.daily_usage AS daily ON daily.id = post.daily_usage_id
          WHERE daily.user_id = $1 AND NOT post.usage_generated_title) AS custom_title`,
      [userId],
    );
    expect(restored.rows[0]).toMatchObject({
      devices: 4,
      agents: 4,
      exact_daily: true,
      separate_aliases: 2,
      candidate_status: "proof_merge",
      decisions: 0,
      generated_title: expect.stringContaining("$0.50"),
      custom_title: "Keep this custom title",
    });
  });

  it("orders discovery and manual resolution locks without a deadlock", async () => {
    const userId = await insertUser(db, { username: "v2_lock_order" });
    const otherDevice = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    await db.query(
      `INSERT INTO public.usage_installation_aliases (user_id, device_id, canonical_device_id, name)
       VALUES ($1, $2, $2, 'same-host'), ($1, $3, $3, 'same-host')`,
      [userId, DEVICE_ID, otherDevice],
    );
    await db.query("SELECT public.discover_usage_device_candidates($1)", [userId]);
    const candidate = await db.query<{ id: string }>(
      "SELECT id FROM public.usage_device_reconciliation_candidates WHERE user_id = $1", [userId],
    );
    const concurrent = await openTestDb();
    let pending: Promise<unknown> | undefined;
    try {
      const backend = await concurrent.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      await db.query("BEGIN");
      await db.query("SET LOCAL statement_timeout = '3s'");
      await db.query("SELECT public.discover_usage_device_candidates($1)", [userId]);
      pending = concurrent.query(
        "SELECT public.resolve_usage_device_candidate($1, $2, 'keep_separate')",
        [userId, candidate.rows[0].id],
      ).catch((error: { code: string }) => error.code);
      await expect.poll(async () => {
        const waiting = await db.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1", [backend.rows[0].pid]);
        return waiting.rows[0]?.wait_event_type;
      }).toBe("Lock");
      // A repair resolves after discovery in the same transaction. The competing
      // manual request must wait before holding any candidate row or user lock.
      await db.query("SELECT public.resolve_usage_device_candidate($1, $2, 'keep_separate')", [userId, candidate.rows[0].id]);
      await db.query("COMMIT");
      expect(await pending).toBe("P0002");
      const decisions = await db.query("SELECT count(*)::int AS n FROM public.usage_device_reconciliation_decisions WHERE user_id = $1", [userId]);
      expect(decisions.rows[0].n).toBe(1);
    } finally {
      await db.query("ROLLBACK");
      if (pending) await pending;
      await concurrent.end();
    }
  });

  it("rejects an ambiguous merge without changing divergent usage, aliases, or the ledger", async () => {
    const userId = await insertUser(db, { username: "v2_ambiguous_merge" });
    const deviceA = "30000000-0000-4000-8000-000000000003";
    const deviceB = "40000000-0000-4000-8000-000000000004";

    await db.query(
      `INSERT INTO public.usage_installation_aliases (
         device_id, user_id, canonical_device_id, name, created_at, updated_at
       ) VALUES
         ($2, $1, $2, 'same-host', now() - interval '2 days', now()),
         ($3, $1, $3, 'same-host', now() - interval '1 day', now())`,
      [userId, deviceA, deviceB],
    );
    await db.query(
      `INSERT INTO public.usage_agent_daily (
         user_id, date, device_id, agent, models, input_tokens, output_tokens,
         reasoning_output_tokens, cache_creation_tokens, cache_read_tokens,
         total_tokens, cost_usd, model_breakdown, content_hash, collector
       ) VALUES
         ($1, $2, $3, 'codex', ARRAY['gpt-5.6'], 100, 20, 10, 0, 30, 160, 0.25,
          $5::jsonb, repeat('a', 64), $7::jsonb),
         ($1, $2, $4, 'codex', ARRAY['gpt-5.6'], 200, 40, 20, 0, 60, 320, 0.50,
          $6::jsonb, repeat('b', 64), $7::jsonb)`,
      [
        userId,
        today,
        deviceA,
        deviceB,
        JSON.stringify(v2Agent().model_breakdown),
        JSON.stringify(v2Agent({
          input_tokens: 200,
          output_tokens: 40,
          reasoning_output_tokens: 20,
          cache_read_tokens: 60,
          total_tokens: 320,
          cost_usd: 0.5,
          model_breakdown: [{
            model: "gpt-5.6",
            input_tokens: 200,
            output_tokens: 40,
            reasoning_output_tokens: 20,
            cache_creation_tokens: 0,
            cache_read_tokens: 60,
            total_tokens: 320,
            cost_usd: 0.5,
          }],
        }).model_breakdown),
        JSON.stringify({ name: "ccusage", version: "20.0.26", pricing_mode: "online" }),
      ],
    );
    await db.query(
      `INSERT INTO public.device_usage (
         user_id, date, device_id, device_name, cost_usd, input_tokens,
         output_tokens, reasoning_output_tokens, cache_creation_tokens,
         cache_read_tokens, total_tokens, models, model_breakdown,
         session_count, raw_hash, collector_meta
       ) VALUES
         ($1, $2, $3, 'same-host', 0.25, 100, 20, 10, 0, 30, 160,
          '["gpt-5.6"]'::jsonb, '[{"model":"gpt-5.6","cost_usd":0.25}]'::jsonb,
          1, repeat('a', 64), $5::jsonb),
         ($1, $2, $4, 'same-host', 0.50, 200, 40, 20, 0, 60, 320,
          '["gpt-5.6"]'::jsonb, '[{"model":"gpt-5.6","cost_usd":0.50}]'::jsonb,
          1, repeat('b', 64), $5::jsonb)`,
      [
        userId,
        today,
        deviceA,
        deviceB,
        JSON.stringify({ name: "ccusage", version: "20.0.26", pricing_mode: "online" }),
      ],
    );
    await db.query(
      `INSERT INTO public.daily_usage (
         user_id, date, cost_usd, input_tokens, output_tokens,
         reasoning_output_tokens, cache_creation_tokens, cache_read_tokens,
         total_tokens, models, model_breakdown, session_count, is_verified
       ) VALUES (
         $1, $2, 0.75, 300, 60, 30, 0, 90, 480,
         '["gpt-5.6"]'::jsonb,
         '[{"model":"gpt-5.6","cost_usd":0.75}]'::jsonb, 2, true
       )`,
      [userId, today],
    );

    await db.query("SELECT public.discover_usage_device_candidates($1)", [userId]);
    const candidate = await db.query<{ id: string; status: string }>(
      `SELECT id, status
       FROM public.usage_device_reconciliation_candidates
       WHERE user_id = $1`,
      [userId],
    );
    expect(candidate.rows[0]!.status).toBe("ambiguous");

    const state = () => db.query(`SELECT jsonb_build_object(
      'agents', (SELECT jsonb_agg(to_jsonb(rows) ORDER BY device_id) FROM public.usage_agent_daily rows WHERE user_id = $1),
      'devices', (SELECT jsonb_agg(to_jsonb(rows) ORDER BY device_id) FROM public.device_usage rows WHERE user_id = $1),
      'aliases', (SELECT jsonb_agg(to_jsonb(rows) ORDER BY device_id) FROM public.usage_installation_aliases rows WHERE user_id = $1),
      'candidate', (SELECT to_jsonb(rows) FROM public.usage_device_reconciliation_candidates rows WHERE user_id = $1),
      'ledger', (SELECT count(*) FROM public.usage_corrections_ledger WHERE user_id = $1)
    ) AS state`, [userId]);
    const before = await state();
    await expect(db.query(
      "SELECT public.resolve_usage_device_candidate($1, $2, 'merge')",
      [userId, candidate.rows[0]!.id],
    )).rejects.toMatchObject({ code: "23000" });
    expect((await state()).rows).toEqual(before.rows);
    const merged = await db.query(
      `SELECT
         (SELECT count(*)::int FROM public.usage_agent_daily WHERE user_id = $1) AS agents,
         (SELECT sum(total_tokens)::int FROM public.usage_agent_daily WHERE user_id = $1) AS agent_tokens,
         (SELECT sum(cost_usd)::numeric FROM public.usage_agent_daily WHERE user_id = $1) AS agent_cost,
         (SELECT count(*)::int FROM public.device_usage WHERE user_id = $1) AS devices,
         (SELECT total_tokens::int FROM public.daily_usage WHERE user_id = $1) AS daily_tokens,
         (SELECT cost_usd::numeric FROM public.daily_usage WHERE user_id = $1) AS daily_cost,
         (SELECT count(*)::int FROM public.usage_installation_aliases
          WHERE user_id = $1 AND canonical_device_id = $2) AS canonical_aliases,
         (SELECT status FROM public.usage_device_reconciliation_candidates
          WHERE user_id = $1) AS candidate_status`,
      [userId, deviceA],
    );
    expect(merged.rows[0]).toMatchObject({
      agents: 2,
      agent_tokens: 480,
      devices: 2,
      daily_tokens: 480,
      canonical_aliases: 1,
      candidate_status: "ambiguous",
    });
    expect(Number(merged.rows[0].agent_cost)).toBeCloseTo(0.75, 6);
    expect(Number(merged.rows[0].daily_cost)).toBeCloseTo(0.75, 6);
  });

  it("returns 409 when request_id plus date is retried with different content", async () => {
    const userId = await insertUser(db, { username: "v2_conflict" });
    const token = await mintCliToken(userId, "v2_conflict");

    const first = await callSubmit(v2Body("v2-conflict", "c".repeat(64)), token);
    const conflict = await callSubmit(v2Body("v2-conflict", "d".repeat(64)), token);
    const json = await conflict.json();

    expect(first.status).toBe(200);
    expect(conflict.status).toBe(409);
    expect(json.outcomes[0]).toMatchObject({
      status: "identity_conflict",
      error: { code: "idempotency_conflict" },
    });
    const row = await db.query(
      `SELECT content_hash FROM public.usage_submission_outcomes
       WHERE user_id = $1 AND request_id = 'v2-conflict'`,
      [userId],
    );
    expect(row.rows[0].content_hash).toBe("c".repeat(64));
  });

  it("scopes the same durable installation id independently for each account", async () => {
    const firstUserId = await insertUser(db, { username: "install_owner" });
    const secondUserId = await insertUser(db, { username: "install_second" });
    const firstToken = await mintCliToken(firstUserId, "install_owner");
    const secondToken = await mintCliToken(secondUserId, "install_second");

    const first = await callSubmit(v2Body("installation-owner", "4".repeat(64)), firstToken);
    const second = await callSubmit(
      v2Body("installation-second-account", "5".repeat(64)),
      secondToken,
    );
    const json = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(json.outcomes[0]).toMatchObject({
      status: "committed",
    });
    const rows = await db.query(
      `SELECT
         (SELECT count(*)::int FROM public.usage_installation_aliases
          WHERE device_id = $1) AS aliases,
         (SELECT count(*)::int FROM public.usage_agent_daily
          WHERE device_id = $1) AS agents`,
      [DEVICE_ID],
    );
    expect(rows.rows[0]).toEqual({ aliases: 2, agents: 2 });
  });

  it("rolls back aliases when the transactional RPC fails after identity resolution", async () => {
    const userId = await insertUser(db, { username: "v2_rollback" });
    const invalidEntry = {
      date: today,
      content_hash: "e".repeat(64),
      agents: [v2Agent(), v2Agent({ agent: "x".repeat(101) })],
    };

    await expect(db.query(
      `SELECT public.submit_usage_day_v2(
         $1::uuid,
         'rollback-request',
         'cli',
         'UTC',
         $2::jsonb,
         $3::jsonb,
         $4::jsonb,
         $5,
         true
       )`,
      [
        userId,
        JSON.stringify({ id: DEVICE_ID, name: "rollback-device" }),
        JSON.stringify({ name: "ccusage", version: "20.0.26", pricing_mode: "online" }),
        JSON.stringify(invalidEntry),
        "f".repeat(64),
      ],
    )).rejects.toThrow();

    const rows = await db.query(
      `SELECT
         (SELECT count(*)::int FROM public.usage_installation_aliases WHERE user_id = $1) AS aliases,
         (SELECT count(*)::int FROM public.usage_agent_daily WHERE user_id = $1) AS agents,
         (SELECT count(*)::int FROM public.device_usage WHERE user_id = $1) AS devices,
         (SELECT count(*)::int FROM public.daily_usage WHERE user_id = $1) AS daily,
         (SELECT count(*)::int FROM public.posts WHERE user_id = $1) AS posts,
         (SELECT count(*)::int FROM public.usage_submission_outcomes WHERE user_id = $1) AS outcomes`,
      [userId],
    );
    expect(rows.rows[0]).toEqual({
      aliases: 0,
      agents: 0,
      devices: 0,
      daily: 0,
      posts: 0,
      outcomes: 0,
    });
  });

  it("allows trusted ccusage-by-agent-v2 corrections but reports rejected decreases", async () => {
    const userId = await insertUser(db, { username: "v2_correction" });
    const token = await mintCliToken(userId, "v2_correction");
    await callSubmit(v2Body("v2-high", "1".repeat(64), {
      agents: [v2Agent({
        input_tokens: 200,
        total_tokens: 260,
        cost_usd: 0.5,
        model_breakdown: [{
          model: "gpt-5.6",
          input_tokens: 200,
          output_tokens: 20,
          reasoning_output_tokens: 10,
          cache_creation_tokens: 0,
          cache_read_tokens: 30,
          total_tokens: 260,
          cost_usd: 0.5,
        }],
      })],
    }), token);

    const rejected = await callSubmit(v2Body("v2-untrusted-low", "2".repeat(64)), token);
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ outcomes: [{
      status: "permanent_error", error: { code: "usage_regression_rejected" },
    }] });
    let row = await db.query(
      "SELECT total_tokens, cost_usd FROM public.usage_agent_daily WHERE user_id = $1",
      [userId],
    );
    expect(Number(row.rows[0].total_tokens)).toBe(260);
    expect(Number(row.rows[0].cost_usd)).toBeCloseTo(0.5, 6);

    const belowFloor = await callSubmit(v2Body("v2-below-floor-low", "3".repeat(64), {
      authoritative_correction: true,
      migration_id: "ccusage-by-agent-v2",
    }, "20.0.17"), token);
    expect(belowFloor.status).toBe(426);
    const invalidVersion = await callSubmit(v2Body("v2-invalid-version-low", "4".repeat(64), {
      authoritative_correction: true,
      migration_id: "ccusage-by-agent-v2",
    }, "not-semver"), token);
    expect(invalidVersion.status).toBe(426);
    row = await db.query(
      "SELECT total_tokens, cost_usd, migration_id FROM public.usage_agent_daily WHERE user_id = $1",
      [userId],
    );
    expect(Number(row.rows[0].total_tokens)).toBe(260);
    expect(Number(row.rows[0].cost_usd)).toBeCloseTo(0.5, 6);
    expect(row.rows[0].migration_id).toBeNull();

    await callSubmit(v2Body("v2-trusted-later-major-low", "5".repeat(64), {
      authoritative_correction: true,
      migration_id: "ccusage-by-agent-v2",
    }, "21.0.0+canary.1"), token);
    row = await db.query(
      "SELECT total_tokens, cost_usd, migration_id FROM public.usage_agent_daily WHERE user_id = $1",
      [userId],
    );
    expect(Number(row.rows[0].total_tokens)).toBe(160);
    expect(Number(row.rows[0].cost_usd)).toBeCloseTo(0.25, 6);
    expect(row.rows[0].migration_id).toBe("ccusage-by-agent-v2");
  });

  it("reprices and redistributes a trusted snapshot without losing total-token progress", async () => {
    const userId = await insertUser(db, { username: "v2_reprice" });
    const token = await mintCliToken(userId, "v2_reprice");
    await callSubmit(v2Body("reprice-before", "a".repeat(64)), token);
    const next = v2Agent();
    next.input_tokens += 10;
    next.cache_read_tokens -= 10;
    next.cost_usd = 0.2;
    next.model_breakdown[0]!.input_tokens += 10;
    next.model_breakdown[0]!.cache_read_tokens -= 10;
    next.model_breakdown[0]!.cost_usd = 0.2;
    const res = await callSubmit(v2Body("reprice-after", "b".repeat(64), { agents: [next] }), token);
    expect(res.status).toBe(200);
    const row = await db.query("SELECT total_tokens, input_tokens, cache_read_tokens, cost_usd FROM public.daily_usage WHERE user_id = $1", [userId]);
    expect(Number(row.rows[0].total_tokens)).toBe(160);
    expect(Number(row.rows[0].input_tokens)).toBe(110);
    expect(Number(row.rows[0].cache_read_tokens)).toBe(20);
    expect(Number(row.rows[0].cost_usd)).toBeCloseTo(0.2, 6);
  });

  it("accepts a newer lower source correction once and rejects stale decreases and reinflation", async () => {
    const userId = await insertUser(db, { username: "v2_newer_collector" });
    const token = await mintCliToken(userId, "v2_newer_collector");
    const inflated = v2Agent({ input_tokens: 200, total_tokens: 260, cost_usd: 0.5 });
    inflated.model_breakdown[0]!.input_tokens = 200;
    inflated.model_breakdown[0]!.total_tokens = 260;
    inflated.model_breakdown[0]!.cost_usd = 0.5;
    const claude = v2Agent({ agent: "claude" });
    const initial = await callSubmit(v2Body("newer-before", "a".repeat(64), {
      agents: [inflated, claude],
    }, "20.0.26"), token);
    expect(initial.status).toBe(200);
    const initialSources = [
      { agent: "claude", total_tokens: 160, cost_usd: 0.25, version: "20.0.26" },
      { agent: "codex", total_tokens: 260, cost_usd: 0.5, version: "20.0.26" },
    ];
    await expectAccounting(userId, initialSources);

    const sameVersion = await callSubmit(v2Body("newer-same", "b".repeat(64), {
      agents: [v2Agent()],
    }, "20.0.26"), token);
    expect(sameVersion.status).toBe(400);
    expect(await sameVersion.json()).toMatchObject({ outcomes: [{
      error: { code: "usage_regression_rejected" },
    }] });
    await expectAccounting(userId, initialSources);

    // Only Codex was recollected. The omitted Claude source remains intact.
    const correction = v2Body("newer-after", "c".repeat(64), {}, "20.0.27");
    const newer = await callSubmit(correction, token);
    expect(newer.status).toBe(200);
    expect(await newer.json()).toMatchObject({ outcomes: [{ status: "committed" }] });
    const correctedSources = [initialSources[0]!, {
      agent: "codex", total_tokens: 160, cost_usd: 0.25, version: "20.0.27",
    }];
    await expectAccounting(userId, correctedSources);
    const retry = await callSubmit(correction, token);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ outcomes: [{ status: "unchanged" }] });
    await expectAccounting(userId, correctedSources);

    const smaller = v2Agent();
    smaller.input_tokens -= 10;
    smaller.total_tokens -= 10;
    smaller.model_breakdown[0]!.input_tokens -= 10;
    smaller.model_breakdown[0]!.total_tokens -= 10;
    for (const [requestId, version, agents, errorCode] of [
      ["corrected-same-low", "20.0.27", [smaller], "usage_regression_rejected"],
      ["corrected-older-low", "20.0.26", [smaller], "usage_collector_outdated"],
      // A new source first in the payload must also be rolled back atomically.
      ["corrected-older-inflated", "20.0.26", [v2Agent({ agent: "new-source" }), inflated], "usage_collector_outdated"],
    ] as const) {
      const rejected = await callSubmit(v2Body(requestId, "d".repeat(64), {
        agents,
        ...(version === "20.0.26" ? {
          authoritative_correction: true,
          migration_id: "ccusage-by-agent-v2",
        } : {}),
      }, version), token);
      expect(rejected.status, requestId).toBe(400);
      expect(await rejected.json()).toMatchObject({ outcomes: [{
        status: "permanent_error", error: { code: errorCode },
      }] });
      await expectAccounting(userId, correctedSources);
    }
    const outcomes = await db.query(
      "SELECT request_id FROM public.usage_submission_outcomes WHERE user_id = $1 ORDER BY request_id",
      [userId],
    );
    expect(outcomes.rows).toEqual([
      { request_id: "newer-after" }, { request_id: "newer-before" },
    ]);
  });

  it.each(["authoritative", "legacy"] as const)(
    "fences deletion of a newer omitted %s source before writing the date",
    async (mode) => {
      const username = mode === "authoritative" ? "v2_omit_auth" : "v2_omit_legacy";
      const userId = await insertUser(db, { username });
      const token = await mintCliToken(userId, username);
      if (mode === "authoritative") {
        expect((await callSubmit(v2Body("omitted-before", "5".repeat(64), {
          agents: [v2Agent(), v2Agent({ agent: "claude" })],
        }, "20.0.26"), token)).status).toBe(200);
        expect((await callSubmit(v2Body("omitted-newer", "6".repeat(64), {
          agents: [v2Agent({ agent: "claude" })],
        }, "20.0.28"), token)).status).toBe(200);
        await expectAccounting(userId, [
          { agent: "claude", total_tokens: 160, cost_usd: 0.25, version: "20.0.28" },
          { agent: "codex", total_tokens: 160, cost_usd: 0.25, version: "20.0.26" },
        ]);
      } else {
        expect((await callSubmit(v2Body("omitted-before", "5".repeat(64), {
          agents: [v2Agent({ agent: "legacy-unpartitioned" })],
        }, "20.0.28"), token)).status).toBe(200);
        await expectAccounting(userId, [{
          agent: "legacy-unpartitioned", total_tokens: 160, cost_usd: 0.25, version: "20.0.28",
        }]);
      }
      const persistedState = async () => {
        const state = [];
        for (const table of [
          "usage_agent_daily", "device_usage", "daily_usage", "posts", "usage_submission_outcomes",
        ]) {
          const result = await db.query(
            `SELECT to_jsonb(stored) AS row FROM public.${table} AS stored
             WHERE user_id = $1 ORDER BY to_jsonb(stored)::text`,
            [userId],
          );
          state.push({ table, rows: result.rows });
        }
        return state;
      };
      const before = await persistedState();
      const deletionFlags = mode === "authoritative" ? {
        authoritative_correction: true,
        migration_id: "ccusage-by-agent-v2",
      } : {};
      const stale = await callSubmit(v2Body("omitted-stale", "7".repeat(64), {
        ...deletionFlags,
        agents: [v2Agent()],
      }, "20.0.27"), token);
      expect(stale.status).toBe(400);
      expect(await stale.json()).toMatchObject({ outcomes: [{
        status: "permanent_error", error: { code: "usage_collector_outdated" },
      }] });
      expect(await persistedState()).toEqual(before);

      // The deletion remains supported when its collector is at least as new.
      const current = await callSubmit(v2Body("omitted-current", "8".repeat(64), {
        ...deletionFlags,
        agents: [v2Agent()],
      }, "20.0.28"), token);
      expect(current.status).toBe(200);
      expect(await current.json()).toMatchObject({ outcomes: [{ status: "committed" }] });
      await expectAccounting(userId, [{
        agent: "codex", total_tokens: 160, cost_usd: 0.25, version: "20.0.28",
      }]);
    },
  );

  it("preserves an omitted source and rejects incomplete source regression until its snapshot grows", async () => {
    const userId = await insertUser(db, { username: "v2_partial_source" });
    const token = await mintCliToken(userId, "v2_partial_source");
    const initial = await callSubmit(v2Body("partial-before", "1".repeat(64), {
      agents: [v2Agent(), v2Agent({ agent: "claude" })],
    }), token);
    expect(initial.status).toBe(200);
    const original = [
      { agent: "claude", total_tokens: 160, cost_usd: 0.25, version: "20.0.26" },
      { agent: "codex", total_tokens: 160, cost_usd: 0.25, version: "20.0.26" },
    ];
    await expectAccounting(userId, original);

    const incomplete = v2Agent();
    incomplete.input_tokens -= 50;
    incomplete.total_tokens -= 50;
    incomplete.model_breakdown[0]!.input_tokens -= 50;
    incomplete.model_breakdown[0]!.total_tokens -= 50;
    const rejected = await callSubmit(v2Body("partial-incomplete", "2".repeat(64), {
      agents: [incomplete],
    }), token);
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ outcomes: [{
      status: "permanent_error", error: { code: "usage_regression_rejected" },
    }] });
    await expectAccounting(userId, original);

    const grown = v2Agent();
    grown.input_tokens += 40;
    grown.total_tokens += 40;
    grown.cost_usd = 0.3;
    grown.model_breakdown[0]!.input_tokens += 40;
    grown.model_breakdown[0]!.total_tokens += 40;
    grown.model_breakdown[0]!.cost_usd = 0.3;
    const accepted = await callSubmit(v2Body("partial-growth", "3".repeat(64), {
      agents: [grown],
    }), token);
    expect(accepted.status).toBe(200);
    await expectAccounting(userId, [original[0]!, {
      agent: "codex", total_tokens: 200, cost_usd: 0.3, version: "20.0.26",
    }]);
    const outcomes = await db.query(
      "SELECT request_id FROM public.usage_submission_outcomes WHERE user_id = $1 ORDER BY request_id",
      [userId],
    );
    expect(outcomes.rows).toEqual([
      { request_id: "partial-before" }, { request_id: "partial-growth" },
    ]);
  });

  it("rejects the whole date before writing any agent when one snapshot regresses", async () => {
    const userId = await insertUser(db, { username: "v2_atomic_reject" });
    const token = await mintCliToken(userId, "v2_atomic_reject");
    await callSubmit(v2Body("atomic-before", "a".repeat(64)), token);
    const smaller = v2Agent();
    smaller.input_tokens -= 10;
    smaller.total_tokens -= 10;
    smaller.model_breakdown[0]!.input_tokens -= 10;
    smaller.model_breakdown[0]!.total_tokens -= 10;
    const res = await callSubmit(v2Body("atomic-after", "b".repeat(64), {
      agents: [v2Agent({ agent: "claude" }), smaller],
    }), token);
    expect(res.status).toBe(400);
    const row = await db.query("SELECT agent FROM public.usage_agent_daily WHERE user_id = $1", [userId]);
    expect(row.rows).toEqual([{ agent: "codex" }]);
    const outcomes = await db.query("SELECT request_id FROM public.usage_submission_outcomes WHERE user_id = $1", [userId]);
    expect(outcomes.rows).toEqual([{ request_id: "atomic-before" }]);
  });

  it("does not double-count a legacy CLI resubmission after per-agent accounting", async () => {
    const userId = await insertUser(db, { username: "v2_then_legacy" });
    const token = await mintCliToken(userId, "v2_then_legacy");
    await callSubmit(v2Body("partitioned", "a".repeat(64)), token);
    const res = await callSubmit(v2Body("legacy-after", "b".repeat(64), {
      agents: [v2Agent({ agent: "legacy-unpartitioned" })],
    }), token);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ outcomes: [{
      status: "permanent_error", error: { code: "usage_protocol_upgrade_required" },
    }] });
    const rows = await db.query("SELECT agent FROM public.usage_agent_daily WHERE user_id = $1", [userId]);
    expect(rows.rows).toEqual([{ agent: "codex" }]);
  });

  it("protects old-server writes made after the migration backfill", async () => {
    const userId = await insertUser(db, { username: "v1_deploy_bridge" });
    const token = await mintCliToken(userId, "v1_deploy_bridge");
    const legacy = { agents: [v2Agent({ agent: "legacy-unpartitioned" })] };
    await callSubmit(v2Body("bridge-before", "a".repeat(64), legacy), token);
    await db.query("UPDATE public.device_usage SET input_tokens = input_tokens + 100, total_tokens = total_tokens + 100, cost_usd = 1 WHERE user_id = $1", [userId]);
    const res = await callSubmit(v2Body("bridge-stale", "b".repeat(64), legacy), token);
    expect(res.status).toBe(400);
    const row = await db.query("SELECT total_tokens, cost_usd FROM public.device_usage WHERE user_id = $1", [userId]);
    expect(Number(row.rows[0].total_tokens)).toBe(260);
    expect(Number(row.rows[0].cost_usd)).toBe(1);
  });

  it("atomically replaces legacy-unpartitioned accounting with a trusted v2 snapshot", async () => {
    const userId = await insertUser(db, { username: "v2_legacy_replace" });
    const token = await mintCliToken(userId, "v2_legacy_replace");
    await db.query(
      `INSERT INTO public.usage_agent_daily (
         user_id, date, device_id, agent, models, input_tokens, output_tokens,
         reasoning_output_tokens, cache_creation_tokens, cache_read_tokens,
         total_tokens, cost_usd, model_breakdown, content_hash, collector
       ) VALUES (
         $1, $2, $3, 'legacy-unpartitioned', ARRAY['gpt-5.6'],
         100, 20, 10, 0, 30, 160, 0.25,
         $4::jsonb, repeat('a', 64), '{"name":"legacy-unpartitioned"}'::jsonb
       )`,
      [userId, today, DEVICE_ID, JSON.stringify(v2Agent().model_breakdown)],
    );
    await db.query(
      `INSERT INTO public.device_usage (
         user_id, date, device_id, device_name, cost_usd, input_tokens,
         output_tokens, reasoning_output_tokens, cache_creation_tokens,
         cache_read_tokens, total_tokens, models, model_breakdown, session_count
       ) VALUES (
         $1, $2, $3, 'legacy-device', 0.25, 100, 20, 10, 0, 30, 160,
         '["gpt-5.6"]'::jsonb,
         '[{"model":"gpt-5.6","cost_usd":0.25}]'::jsonb, 1
       )`,
      [userId, today, DEVICE_ID],
    );
    await db.query(
      `INSERT INTO public.daily_usage (
         user_id, date, cost_usd, input_tokens, output_tokens,
         reasoning_output_tokens, cache_creation_tokens, cache_read_tokens,
         total_tokens, models, model_breakdown, session_count
       ) VALUES (
         $1, $2, 0.25, 100, 20, 10, 0, 30, 160,
         '["gpt-5.6"]'::jsonb,
         '[{"model":"gpt-5.6","cost_usd":0.25}]'::jsonb, 1
       )`,
      [userId, today],
    );

    const response = await callSubmit(
      v2Body("v2-legacy-replace", "8".repeat(64)),
      token,
    );

    expect(response.status).toBe(200);
    const exact = await db.query(
      `SELECT
         (SELECT array_agg(agent ORDER BY agent)
          FROM public.usage_agent_daily WHERE user_id = $1) AS agents,
         (SELECT total_tokens::int FROM public.device_usage WHERE user_id = $1) AS device_tokens,
         (SELECT total_tokens::int FROM public.daily_usage WHERE user_id = $1) AS daily_tokens`,
      [userId],
    );
    expect(exact.rows[0]).toEqual({
      agents: ["codex"],
      device_tokens: 160,
      daily_tokens: 160,
    });
  });

  it("erases owned v2 state with service credentials while preserving aggregate usage and other accounts", async () => {
    const userId = await insertUser(db, { username: "v2_delete" });
    const otherId = await insertUser(db, { username: "v2_preserve" });
    for (const [id, username] of [[userId, "v2_delete"], [otherId, "v2_preserve"]]) {
      const response = await callSubmit(v2Body(`delete-${id}`, "a".repeat(64)), await mintCliToken(id, username));
      expect(response.status).toBe(200);
    }
    const candidate = await db.query<{ id: string }>(
      `INSERT INTO public.usage_device_reconciliation_candidates (
        user_id, device_id_a, device_id_b, normalized_hostname, status
      ) VALUES ($1, $2, 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'private-host', 'kept_separate') RETURNING id`,
      [userId, DEVICE_ID],
    );
    await db.query(
      "INSERT INTO public.usage_device_reconciliation_decisions (user_id, candidate_id, decision) VALUES ($1, $2, 'keep_separate')",
      [userId, candidate.rows[0].id],
    );
    const batch = await db.query<{ id: string }>(
      "INSERT INTO public.usage_repair_batches (reason) VALUES ('shared repair batch') RETURNING id",
    );
    await db.query(
      `INSERT INTO public.usage_corrections_ledger (batch_id, user_id, reason, table_name, row_key, before_row)
       VALUES ($1, $2, 'repair', 'usage_installation_aliases', '{}'::jsonb, '{"name":"private-host"}'::jsonb)`,
      [batch.rows[0].id, userId],
    );
    const { getServiceClient } = await import("@/lib/supabase/service");
    const service = getServiceClient();
    // Match account deletion's FK order: decisions must disappear before candidates.
    const ownedTables = [
      "device_usage", "usage_installation_aliases", "usage_agent_daily",
      "usage_submission_outcomes", "usage_device_reconciliation_decisions",
      "usage_corrections_ledger",
    ];
    for (const table of [...ownedTables, "usage_device_reconciliation_candidates"]) {
      const result = await service.from(table).delete().eq("user_id", userId);
      expect(result.error, table).toBeNull();
      const remaining = await db.query(`SELECT count(*)::int AS n FROM public.${table} WHERE user_id = $1`, [userId]);
      expect(remaining.rows[0].n, table).toBe(0);
    }
    const preserved = await db.query(
      `SELECT
        (SELECT count(*)::int FROM public.daily_usage WHERE user_id = $1) AS aggregate_rows,
        (SELECT count(*)::int FROM public.usage_agent_daily WHERE user_id = $2) AS other_agent_rows,
        (SELECT count(*)::int FROM public.usage_repair_batches WHERE id = $3) AS shared_batches`,
      [userId, otherId, batch.rows[0].id],
    );
    expect(preserved.rows[0]).toEqual({ aggregate_rows: 1, other_agent_rows: 1, shared_batches: 1 });
  });

  it("keeps v2 tables and RPC private to service_role", async () => {
    const grants = await db.query(
      `SELECT grantee, privilege_type, table_name
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND table_name IN (
           'usage_installation_aliases',
           'usage_agent_daily',
           'usage_submission_outcomes',
           'usage_device_reconciliation_decisions',
           'usage_device_reconciliation_candidates',
           'usage_repair_batches',
           'usage_corrections_ledger',
           'device_usage'
         )
       ORDER BY table_name, grantee, privilege_type`,
    );
    const grantedRoles = new Set(
      grants.rows
        .filter((row) => row.table_name !== "device_usage")
        .map((row) => row.grantee),
    );
    expect(grantedRoles).toContain("service_role");
    expect(grantedRoles).not.toContain("anon");
    expect(grantedRoles).not.toContain("authenticated");
    const privileges = new Set(grants.rows.filter((row) => row.grantee === "service_role").map(
      (row) => `${row.table_name}:${row.privilege_type}`,
    ));
    expect(privileges).toContain("usage_submission_outcomes:UPDATE");
    expect(privileges).toContain("usage_corrections_ledger:UPDATE");
    expect(privileges).toContain("usage_device_reconciliation_decisions:DELETE");
    for (const table of [
      "device_usage", "usage_installation_aliases", "usage_agent_daily",
      "usage_submission_outcomes", "usage_device_reconciliation_candidates",
      "usage_device_reconciliation_decisions", "usage_corrections_ledger",
    ]) {
      expect(privileges).toContain(`${table}:DELETE`);
    }
    const rls = await db.query(
      `SELECT relname, relrowsecurity
       FROM pg_class
       JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
       WHERE pg_namespace.nspname = 'public'
         AND relname IN (
           'usage_installation_aliases',
           'usage_agent_daily',
           'usage_submission_outcomes',
           'usage_device_reconciliation_candidates',
           'usage_device_reconciliation_decisions',
           'usage_repair_batches',
           'usage_corrections_ledger'
         )`,
    );
    expect(rls.rows).toHaveLength(7);
    expect(rls.rows.every((row) => row.relrowsecurity)).toBe(true);
    const functionGrants = await db.query(
      `SELECT grantee, routine_name
       FROM information_schema.routine_privileges
       WHERE specific_schema = 'public'
         AND routine_name IN (
           'usage_web_installation_id', 'submit_usage_day_v2',
           'list_usage_device_candidates', 'discover_usage_device_candidates',
           'resolve_usage_device_candidate', 'start_usage_repair_batch',
           'run_usage_repair_batch', 'rollback_usage_repair_batch',
           'apply_usage_device_overlap_evidence', 'usage_device_day_token_fingerprint',
           'usage_entry_token_fingerprint'
         )`,
    );
    const functionRoles = new Set(functionGrants.rows.map((row) => row.grantee));
    expect(functionRoles).toContain("service_role");
    expect(functionRoles).not.toContain("anon");
    expect(functionRoles).not.toContain("authenticated");
    expect(functionRoles).not.toContain("PUBLIC");
    expect(new Set(functionGrants.rows.filter((row) => row.grantee === "service_role").map((row) => row.routine_name)).size).toBe(11);

    // Exercise PostgreSQL's permission boundary, including the new overlap helper.
    const privateCalls = [
      "SELECT public.list_usage_device_candidates(NULL::uuid)",
      "SELECT public.resolve_usage_device_candidate(NULL::uuid, NULL::uuid, 'keep_separate')",
      "SELECT public.apply_usage_device_overlap_evidence(NULL::uuid, NULL::uuid, NULL::uuid[], NULL::date, NULL::jsonb)",
      "SELECT public.submit_usage_day_v2(NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::jsonb, NULL::jsonb, NULL::jsonb, NULL::text, true)",
    ];
    for (const role of ["anon", "authenticated"]) {
      for (const query of privateCalls) {
        await db.query("BEGIN");
        try {
          await db.query(`SET LOCAL ROLE ${role}`);
          await expect(db.query(query), `${role}: ${query}`).rejects.toMatchObject({ code: "42501" });
        } finally {
          await db.query("ROLLBACK");
        }
      }
    }
    await db.query("BEGIN");
    try {
      await db.query("SET LOCAL ROLE service_role");
      const allowed = await db.query("SELECT * FROM public.list_usage_device_candidates(NULL::uuid)");
      expect(allowed.rows).toEqual([]);
    } finally {
      await db.query("ROLLBACK");
    }
  });

  it("rejects unauthenticated requests without writing anything", async () => {
    const before = await db.query("SELECT count(*)::int AS n FROM public.daily_usage");
    const res = await callSubmit(
      {
        entries: [
          {
            date: today,
            data: {
              date: today,
              models: ["claude-sonnet-4-5"],
              inputTokens: 100,
              outputTokens: 50,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              totalTokens: 150,
              costUSD: 0.01,
            },
          },
        ],
        source: "cli",
        device_id: DEVICE_ID,
      },
      "not-a-real-token",
    );
    expect(res.status).toBe(401);
    const after = await db.query("SELECT count(*)::int AS n FROM public.daily_usage");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("writes a real daily_usage + device_usage + post row when the CLI submits valid data", async () => {
    const userId = await insertUser(db, { username: "integration_user" });
    const token = await mintCliToken(userId, "integration_user");

    const res = await callSubmit(
      {
        entries: [
          {
            date: today,
            data: {
              date: today,
              models: ["claude-sonnet-4-5-20250929"],
              inputTokens: 1000,
              outputTokens: 500,
              reasoningOutputTokens: 125,
              cacheCreationTokens: 100,
              cacheReadTokens: 200,
              totalTokens: 1925,
              costUSD: 0.05,
              modelBreakdown: [{ model: "claude-sonnet-4-5-20250929", cost_usd: 0.05 }],
            },
          },
        ],
        source: "cli",
        device_id: DEVICE_ID,
        device_name: "test-device",
        collector: { ccusage_version: "20.0.26" },
      },
      token,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(1);
    expect(json.results[0].action).toBe("created");

    // Real row in real Postgres — the only assertion that proves the route
    // actually persisted what it said it did.
    const { rows } = await db.query<{
      cost_usd: string;
      input_tokens: string;
      output_tokens: string;
      reasoning_output_tokens: string;
      total_tokens: string;
      models: string[];
      session_count: number;
    }>(
      `SELECT cost_usd, input_tokens, output_tokens, reasoning_output_tokens, total_tokens, models, session_count
       FROM public.daily_usage
       WHERE user_id = $1 AND date = $2`,
      [userId, today],
    );
    expect(rows).toHaveLength(1);
    // Postgres NUMERIC comes back as string from pg.Client; that's intentional
    // (no precision loss). Coerce in the test, not the assertion target.
    expect(Number(rows[0].cost_usd)).toBeCloseTo(0.05, 6);
    expect(Number(rows[0].input_tokens)).toBe(1000);
    expect(Number(rows[0].output_tokens)).toBe(500);
    expect(Number(rows[0].reasoning_output_tokens)).toBe(125);
    expect(Number(rows[0].total_tokens)).toBe(1925);
    expect(rows[0].models).toContain("claude-sonnet-4-5-20250929");

    // The route also writes a device_usage row keyed by device_id.
    const dev = await db.query(
      `SELECT count(*)::int AS n, max(reasoning_output_tokens)::int AS reasoning_output_tokens
       FROM public.device_usage
       WHERE user_id = $1 AND date = $2 AND device_id = $3`,
      [userId, today, DEVICE_ID],
    );
    expect(dev.rows[0].n).toBe(1);
    expect(dev.rows[0].reasoning_output_tokens).toBe(125);

    // And a post row.
    const posts = await db.query(
      `SELECT count(*)::int AS n FROM public.posts WHERE user_id = $1`,
      [userId],
    );
    expect(posts.rows[0].n).toBe(1);
  });

  it("real CHECK constraint rejects negative cost even if the route's TS validation were bypassed", async () => {
    // Defense-in-depth: this verifies the schema itself is the last line of
    // defense against bad data, not just the route's TypeScript guards.
    const userId = await insertUser(db);
    await expect(
      db.query(
        `INSERT INTO public.daily_usage
           (user_id, date, cost_usd, input_tokens, output_tokens, total_tokens, models, session_count)
         VALUES ($1, $2, -1.00, 100, 50, 150, ARRAY['claude-sonnet'], 1)`,
        [userId, today],
      ),
    ).rejects.toThrow();
  });

  it("rejects dates outside the 30-day backfill window with a real 400", async () => {
    const userId = await insertUser(db);
    const token = await mintCliToken(userId, "user");
    const oldDate = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);

    const res = await callSubmit(
      {
        entries: [
          {
            date: oldDate,
            data: {
              date: oldDate,
              models: ["claude-sonnet-4-5"],
              inputTokens: 100,
              outputTokens: 50,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              totalTokens: 150,
              costUSD: 0.01,
            },
          },
        ],
        source: "cli",
        device_id: DEVICE_ID,
      },
      token,
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/outside the 30-day backfill window/);

    // No row leaked through.
    const after = await db.query("SELECT count(*)::int AS n FROM public.daily_usage");
    expect(after.rows[0].n).toBe(0);
  });

  it("emits the X-Straude-Refreshed-Token header when the CLI token is older than the refresh threshold", async () => {
    const userId = await insertUser(db, { username: "old_token_user" });
    // Mint a token whose iat is older than the refresh threshold (7 days).
    // We mint normally, then forge a stale-iat token by calling createCliToken
    // under a moved system clock.
    const realDateNow = Date.now;
    try {
      Date.now = () => realDateNow() - 8 * 24 * 60 * 60 * 1000;
      const staleToken = await mintCliToken(userId, "old_token_user");
      Date.now = realDateNow;

      const res = await callSubmit(
        {
          entries: [
            {
              date: today,
              data: {
                date: today,
                models: ["claude-sonnet-4-5"],
                inputTokens: 10,
                outputTokens: 5,
                cacheCreationTokens: 0,
                cacheReadTokens: 0,
                totalTokens: 15,
                costUSD: 0.001,
              },
            },
          ],
          source: "cli",
          device_id: DEVICE_ID,
          collector: { ccusage_version: "20.0.26" },
        },
        staleToken,
      );

      expect(res.status).toBe(200);
      const refreshed = res.headers.get("x-straude-refreshed-token");
      expect(refreshed).toBeTruthy();
      expect(refreshed).not.toBe(staleToken);
    } finally {
      Date.now = realDateNow;
    }
  });
});

describe("device dedupe at submit time (real Supabase)", () => {
  const DEVICE_A = "aaaaaaaa-0000-4000-8000-00000000000a";
  const DEVICE_B = "bbbbbbbb-0000-4000-8000-00000000000b";
  const day = (offset: number) =>
    new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

  // One machine, two installation ids: same display name, same ccusage tokens.
  async function pushDay(
    token: string,
    device: string,
    date: string,
    opts: { cost: number; input?: number; collectorVersion?: string },
  ) {
    const input = opts.input ?? 100;
    const total = input + 20 + 10 + 30;
    const body = v2Body(
      `dedupe-${device.slice(0, 4)}-${date}-${opts.cost}-${input}`,
      crypto.randomUUID().replaceAll("-", "").repeat(2),
      {
        date,
        agents: [v2Agent({
          input_tokens: input,
          total_tokens: total,
          cost_usd: opts.cost,
          model_breakdown: [{
            model: "gpt-5.6",
            input_tokens: input,
            output_tokens: 20,
            reasoning_output_tokens: 10,
            cache_creation_tokens: 0,
            cache_read_tokens: 30,
            total_tokens: total,
            cost_usd: opts.cost,
          }],
        })],
      },
      opts.collectorVersion,
    );
    body.installation = { id: device, name: "Same-Mac" };
    const res = await callSubmit(body, token);
    const json = await res.json();
    return { status: res.status, json, outcome: json.outcomes?.[0] ?? json };
  }

  async function candidate(userId: string) {
    const rows = await db.query(
      `SELECT id, status, overlap_dates::text[] AS overlap, divergent_dates::text[] AS divergent,
              resolved_at
       FROM public.usage_device_reconciliation_candidates WHERE user_id = $1`,
      [userId],
    );
    return rows.rows[0];
  }

  it("auto-merges token-identical devices even when costs differ", async () => {
    const userId = await insertUser(db, { username: "dedupe_merge" });
    const token = await mintCliToken(userId, "dedupe_merge");
    const [d1, d2] = [day(1), day(2)];

    await pushDay(token, DEVICE_A, d1, { cost: 0.25 });
    await pushDay(token, DEVICE_A, d2, { cost: 0.25 });
    const first = await pushDay(token, DEVICE_B, d1, { cost: 0.31 });
    expect(first.outcome.error?.code, JSON.stringify(first.json)).toBe("device_reconciliation_required");
    expect((await candidate(userId)).overlap).toEqual([d1]);
    const second = await pushDay(token, DEVICE_B, d2, { cost: 0.31 });
    expect(second.outcome.status, JSON.stringify(second.json)).not.toBe("identity_conflict");

    expect((await candidate(userId)).status).toBe("merged");
    const totals = await db.query(
      `SELECT (SELECT count(DISTINCT device_id)::int FROM public.device_usage WHERE user_id = $1) AS devices,
              (SELECT count(*)::int FROM public.daily_usage WHERE user_id = $1) AS days,
              (SELECT max(total_tokens)::int FROM public.daily_usage WHERE user_id = $1) AS day_tokens`,
      [userId],
    );
    expect(totals.rows[0]).toEqual({ devices: 1, days: 2, day_tokens: 160 });
  });

  it("stays ambiguous with overlap and divergent evidence when one day differs", async () => {
    const userId = await insertUser(db, { username: "dedupe_divergent" });
    const token = await mintCliToken(userId, "dedupe_divergent");
    const [d1, d2] = [day(1), day(2)];

    for (const d of [d1, d2]) await pushDay(token, DEVICE_A, d, { cost: 0.25 });
    await pushDay(token, DEVICE_B, d1, { cost: 0.25 });
    await pushDay(token, DEVICE_B, d2, { cost: 0.25, input: 999 });

    expect(await candidate(userId)).toMatchObject({
      status: "ambiguous",
      overlap: [d1],
      divergent: [d2],
    });
    const totals = await db.query(
      "SELECT count(DISTINCT device_id)::int AS devices FROM public.device_usage WHERE user_id = $1",
      [userId],
    );
    expect(totals.rows[0].devices).toBe(1);
  });

  it("preserves keep-separate intent as evidence changes and allows an explicit proven merge", async () => {
    const userId = await insertUser(db, { username: "dedupe_keep_separate" });
    const token = await mintCliToken(userId, "dedupe_keep_separate");
    const [d1, d2] = [day(1), day(2)];

    expect((await pushDay(token, DEVICE_A, d1, { cost: 0.25 })).status).toBe(200);
    await pushDay(token, DEVICE_B, d1, { cost: 0.25, input: 500 });
    const pending = await candidate(userId);
    expect(pending).toMatchObject({ status: "ambiguous", divergent: [d1] });

    await db.query(
      "SELECT public.resolve_usage_device_candidate($1, $2, 'keep_separate')",
      [userId, pending.id],
    );
    const resolvedAt = (await candidate(userId)).resolved_at;
    expect(resolvedAt).not.toBeNull();
    const normal = await pushDay(token, DEVICE_B, d1, { cost: 0.25, input: 500 });
    expect(normal.status, JSON.stringify(normal.json)).toBe(200);
    await expectAccounting(userId, [
      { device_id: DEVICE_A, agent: "codex", total_tokens: 160, cost_usd: 0.25, version: "20.0.26" },
      { device_id: DEVICE_B, agent: "codex", total_tokens: 560, cost_usd: 0.25, version: "20.0.26" },
    ], d1);

    // Correct the divergent historical snapshot without clearing user intent.
    const corrected = await pushDay(token, DEVICE_B, d1, {
      cost: 0.4, collectorVersion: "20.0.27",
    });
    expect(corrected.status, JSON.stringify(corrected.json)).toBe(200);
    await expectAccounting(userId, [
      { device_id: DEVICE_A, agent: "codex", total_tokens: 160, cost_usd: 0.25, version: "20.0.26" },
      { device_id: DEVICE_B, agent: "codex", total_tokens: 160, cost_usd: 0.4, version: "20.0.27" },
    ], d1);

    expect((await pushDay(token, DEVICE_A, d2, { cost: 0.25 })).status).toBe(200);
    const identical = await pushDay(token, DEVICE_B, d2, { cost: 0.4 });
    expect(identical.status, JSON.stringify(identical.json)).toBe(200);
    const overlap = [d1, d2].sort();
    expect(await candidate(userId)).toMatchObject({
      status: "kept_separate", overlap, divergent: [], resolved_at: resolvedAt,
    });
    await expectAccounting(userId, [
      { device_id: DEVICE_A, agent: "codex", total_tokens: 160, cost_usd: 0.25, version: "20.0.26" },
      { device_id: DEVICE_B, agent: "codex", total_tokens: 160, cost_usd: 0.4, version: "20.0.26" },
    ], d2);
    const visible = await db.query(
      `SELECT status, overlap_dates::text[] AS overlap, divergent_dates::text[] AS divergent
       FROM public.list_usage_device_candidates($1)`,
      [userId],
    );
    expect(visible.rows).toEqual([{ status: "kept_separate", overlap, divergent: [] }]);

    // Matching evidence enables an explicit reconsideration, never an automatic merge.
    await db.query(
      "SELECT public.resolve_usage_device_candidate($1, $2, 'merge')",
      [userId, pending.id],
    );
    expect((await candidate(userId)).status).toBe("merged");
    for (const date of [d1, d2]) {
      await expectAccounting(userId, [{
        device_id: DEVICE_A, agent: "codex", total_tokens: 160, cost_usd: 0.25, version: "20.0.26",
      }], date);
    }
    const decisions = await db.query(
      `SELECT decision FROM public.usage_device_reconciliation_decisions
       WHERE candidate_id = $1 ORDER BY created_at, id`,
      [pending.id],
    );
    expect(decisions.rows).toEqual([{ decision: "keep_separate" }, { decision: "merge" }]);
  });
});
