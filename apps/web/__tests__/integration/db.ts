import { Client } from "pg";
import { getServiceClient } from "@/lib/supabase/service";

export async function openTestDb(): Promise<Client> {
  const dsn = process.env.TEST_DB_URL;
  if (!dsn) {
    throw new Error(
      "TEST_DB_URL not set — integration tests must run via vitest.integration.config.ts",
    );
  }
  const client = new Client({ connectionString: dsn });
  await client.connect();
  return client;
}

/**
 * Reset the project's data tables to a clean slate. We TRUNCATE just the
 * tables tests write to and leave Supabase-managed schemas (auth, storage,
 * realtime, etc.) alone — those carry the running stack's machinery and
 * shouldn't be wiped by a unit-style cleanup.
 *
 * `RESTART IDENTITY CASCADE` resets serial sequences and drops dependent
 * rows in tables we don't list explicitly, so adding a new test table
 * usually doesn't require updating this list.
 */
const TRUNCATE_TABLES = [
  "usage_corrections_ledger",
  "usage_device_reconciliation_decisions",
  "usage_device_reconciliation_candidates",
  "usage_repair_batches",
  "usage_submission_outcomes",
  "usage_agent_daily",
  "usage_installation_aliases",
  "device_usage",
  "daily_usage",
  "posts",
  "users",
];

export async function cleanDb(client: Client): Promise<void> {
  const truncate = `TRUNCATE TABLE ${
    TRUNCATE_TABLES.map((t) => `public.${t}`).join(", ")
  } RESTART IDENTITY CASCADE`;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await client.query(truncate);
      break;
    } catch (error) {
      const retryable = (error as { code?: string }).code === "40P01";
      if (!retryable || attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
  await client.query(
    "DELETE FROM auth.users WHERE email LIKE '%@example.test'",
  );
}

/** Create a real Auth user and application profile. Returns the user UUID. */
export async function insertUser(
  client: Client,
  overrides: Partial<{
    id: string;
    username: string;
    email: string;
    is_public: boolean;
    onboarding_completed: boolean;
  }> = {},
): Promise<string> {
  const id = overrides.id ?? crypto.randomUUID();
  const username = overrides.username ?? `user_${id.slice(0, 8)}`;
  const email = overrides.email ?? `${username}_${id}@example.test`;

  // GoTrue initializes Auth fields that direct SQL inserts can leave invalid.
  // Include the UUID in default emails because cleanDb preserves Auth users.
  const { error } = await getServiceClient().auth.admin.createUser({
    id,
    email,
    email_confirm: true,
    user_metadata: { user_name: username },
  });
  if (error) {
    throw new Error(`Failed to create integration Auth user: ${error.message}`);
  }

  await client.query(
    `INSERT INTO public.users (id, username, is_public, onboarding_completed, timezone)
     VALUES ($1, $2, $3, $4, 'UTC')
     ON CONFLICT (id) DO UPDATE
       SET username = EXCLUDED.username,
           is_public = EXCLUDED.is_public,
           onboarding_completed = EXCLUDED.onboarding_completed,
           timezone = EXCLUDED.timezone`,
    [id, username, overrides.is_public ?? true, overrides.onboarding_completed ?? true],
  );
  return id;
}
