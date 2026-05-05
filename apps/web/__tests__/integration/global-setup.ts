import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Vitest globalSetup. Verifies the local Supabase stack is reachable and
 * exports the env vars integration tests rely on. The stack is expected to
 * be running already — `bun run local:up` or `bunx supabase start` from the
 * dev workflow. CI runs `supabase start` in a workflow step before this
 * config is invoked.
 *
 * We deliberately do not start/stop the stack from the test runner — that
 * would couple test lifetimes to a 60s boot and force every contributor's
 * machine to tear down/restart Supabase between runs. Run-it-yourself, point
 * tests at it.
 */

const SUPABASE_API_URL = process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54321";
const SUPABASE_DB_URL =
  process.env.SUPABASE_TEST_DB_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";

interface SupabaseStatus {
  ANON_KEY?: string;
  SERVICE_ROLE_KEY?: string;
  JWT_SECRET?: string;
}

function readSupabaseStatus(): SupabaseStatus {
  // `supabase status -o env` prints KEY=value lines for the running stack.
  // Faster and more reliable than parsing the human-readable default.
  try {
    const raw = execSync("bunx supabase status -o env", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out: SupabaseStatus = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
      if (!m) continue;
      const [, k, v] = m;
      if (k === "ANON_KEY") out.ANON_KEY = v;
      if (k === "SERVICE_ROLE_KEY") out.SERVICE_ROLE_KEY = v;
      if (k === "JWT_SECRET") out.JWT_SECRET = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function setup(): Promise<void> {
  // 1. Can we reach the DB?
  const probe = new Client({ connectionString: SUPABASE_DB_URL });
  try {
    await probe.connect();
    await probe.query("SELECT 1");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Integration tests need a running Supabase stack at ${SUPABASE_DB_URL}.\n` +
        `Start it with \`bunx supabase start\` (or \`bun run local:up\`) and re-run.\n` +
        `Underlying error: ${message}`,
    );
  } finally {
    await probe.end().catch(() => undefined);
  }

  // 2. Read the running stack's keys + JWT secret so the route handlers
  //    we exercise can authenticate. These are the ephemeral local values
  //    `supabase start` prints; never production secrets.
  const status = readSupabaseStatus();
  if (!status.SERVICE_ROLE_KEY || !status.ANON_KEY) {
    throw new Error(
      "supabase status did not return SERVICE_ROLE_KEY/ANON_KEY. Is the stack actually running?",
    );
  }

  // 3. Hand env to test workers. The route file in production reads these
  //    same vars; we let it run as-is against the local stack.
  process.env.TEST_DB_URL = SUPABASE_DB_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.ANON_KEY;
  process.env.SUPABASE_SECRET_KEY = status.SERVICE_ROLE_KEY;
  // CLI JWT secret: tests mint real tokens via createCliToken() so the route
  // exercises real verifyCliTokenWithRefresh(). Pin a deterministic test
  // value (does not need to match the supabase JWT secret — it's a separate
  // CLI signing secret).
  process.env.CLI_JWT_SECRET = "integration-test-cli-secret";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
}

export async function teardown(): Promise<void> {
  // Nothing to do — the stack outlives the test run.
}
