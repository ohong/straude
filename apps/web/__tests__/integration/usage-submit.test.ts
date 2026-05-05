import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Client } from "pg";
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

const DEVICE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const today = new Date().toISOString().slice(0, 10);

describe("POST /api/usage/submit (real Supabase)", () => {
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
              cacheCreationTokens: 100,
              cacheReadTokens: 200,
              totalTokens: 1800,
              costUSD: 0.05,
              modelBreakdown: [{ model: "claude-sonnet-4-5-20250929", cost_usd: 0.05 }],
            },
          },
        ],
        source: "cli",
        device_id: DEVICE_ID,
        device_name: "test-device",
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
      total_tokens: string;
      models: string[];
      session_count: number;
    }>(
      `SELECT cost_usd, input_tokens, output_tokens, total_tokens, models, session_count
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
    expect(Number(rows[0].total_tokens)).toBe(1800);
    expect(rows[0].models).toContain("claude-sonnet-4-5-20250929");

    // The route also writes a device_usage row keyed by device_id.
    const dev = await db.query(
      `SELECT count(*)::int AS n FROM public.device_usage
       WHERE daily_usage_id = (SELECT id FROM public.daily_usage WHERE user_id = $1 AND date = $2)`,
      [userId, today],
    );
    expect(dev.rows[0].n).toBe(1);

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
