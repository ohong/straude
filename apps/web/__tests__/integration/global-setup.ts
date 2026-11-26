import { Client } from "pg";
import { localSupabaseEndpoints, parseEnv, readLegacyStatus } from "../../scripts/local-supabase-status.mjs";

function localSupabase() {
  const apiUrl = process.env.SUPABASE_TEST_API_URL;
  const dbUrl = process.env.SUPABASE_TEST_DB_URL;
  if (apiUrl || dbUrl) {
    return localSupabaseEndpoints(new Map([
      ["API_URL", apiUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""],
      ["DB_URL", dbUrl ?? ""],
      ["PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""],
      ["SECRET_KEY", process.env.SUPABASE_SECRET_KEY ?? ""],
    ]));
  }
  return localSupabaseEndpoints(parseEnv(readLegacyStatus()));
}

export async function setup(): Promise<void> {
  const status = localSupabase();
  const probe = new Client({ connectionString: status.dbUrl, connectionTimeoutMillis: 5_000 });
  try {
    await probe.connect();
    await probe.query("SELECT 1");
  } catch (error) {
    throw new Error("Integration tests need a running local Supabase database.", { cause: error });
  } finally {
    await probe.end().catch(() => undefined);
  }

  process.env.TEST_DB_URL = status.dbUrl;
  process.env.NEXT_PUBLIC_SUPABASE_URL = status.apiUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.publishableKey;
  process.env.SUPABASE_SECRET_KEY = status.secretKey;
  process.env.CLI_JWT_SECRET = "integration-test-cli-secret";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
}
