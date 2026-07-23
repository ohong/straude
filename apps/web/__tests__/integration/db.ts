import { Client } from "pg";

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

/** Insert a real user row directly via SQL. Returns the generated UUID. */
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
  const email = overrides.email ?? `${username}@example.test`;

  await client.query(
    `INSERT INTO auth.users (
       id,
       instance_id,
       aud,
       role,
       email,
       encrypted_password,
       email_confirmed_at,
       raw_app_meta_data,
       raw_user_meta_data,
       created_at,
       updated_at
     )
     VALUES (
       $1,
       '00000000-0000-0000-0000-000000000000',
       'authenticated',
       'authenticated',
       $2,
       '',
       now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('user_name', $3::text),
       now(),
       now()
     )`,
    [id, email, username],
  );

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
