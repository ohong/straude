import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const envPath = path.join(appDir, ".env.local");

if (!existsSync(envPath)) {
  console.error("Missing apps/web/.env.local. Run `bun run local:env` first.");
  process.exit(1);
}

function parseEnv(raw) {
  const env = new Map();
  for (const line of raw.split("\n")) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env.set(line.slice(0, idx), line.slice(idx + 1).replace(/^"(.*)"$/, "$1"));
  }
  return env;
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const supabaseUrl = env.get("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = env.get("SUPABASE_SECRET_KEY");

if (!supabaseUrl || !serviceKey) {
  console.error("Local Supabase URL or secret key is missing from apps/web/.env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const demoUsers = [
  {
    email: "mark@local.straude",
    password: "password123",
    username: "mark",
    display_name: "Mark Morgan",
    bio: "Consistency over hype. Shipping with Claude Code every day.",
    country: "US",
    region: "north_america",
    github_username: "markmdev",
    timezone: "America/Los_Angeles",
  },
  {
    email: "alice@local.straude",
    password: "password123",
    username: "alice",
    display_name: "Alice Example",
    bio: "Public demo account for local Straude development.",
    country: "GB",
    region: "europe",
    github_username: "alice-example",
    timezone: "Europe/London",
  },
];

async function ensureUser(user) {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) throw listError;

  const existing = listed.users.find((entry) => entry.email === user.email);
  let authUser = existing ?? null;

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        user_name: user.github_username,
        timezone: user.timezone,
      },
    });

    if (error) {
      throw new Error(`Auth seed failed for ${user.email}: ${error.message}`);
    }

    authUser = data.user;
  }

  if (!authUser) {
    throw new Error(`Could not create local auth user for ${user.email}`);
  }

  const { error: profileError } = await supabase
    .from("users")
    .upsert(
      {
        id: authUser.id,
        username: user.username,
        display_name: user.display_name,
        bio: user.bio,
        country: user.country,
        region: user.region,
        github_username: user.github_username,
        is_public: true,
        timezone: user.timezone,
        onboarding_completed: true,
        email_notifications: false,
        email_mention_notifications: false,
        email_dm_notifications: false,
      },
      { onConflict: "id" }
    );

  if (profileError) throw profileError;
  return authUser.id;
}

function buildUsageRows(userId, multiplier = 1) {
  return Array.from({ length: 21 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (20 - index));
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const cost = Number(((index + 1) * 1.37 * multiplier).toFixed(2));
    const output = Math.round((index + 3) * 420_000 * multiplier);
    const input = Math.round(output * 0.35);

    return {
      user_id: userId,
      date: iso,
      cost_usd: cost,
      input_tokens: input,
      output_tokens: output,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: input + output,
      models: ["gpt-5.3-codex", "claude-opus-4-20250514"],
      model_breakdown: [
        { model: "gpt-5.3-codex", cost_usd: Number((cost * 0.62).toFixed(2)) },
        { model: "claude-opus-4-20250514", cost_usd: Number((cost * 0.38).toFixed(2)) },
      ],
      session_count: 2,
      is_verified: true,
      raw_hash: `local-demo-${userId}-${iso}`,
    };
  });
}

function buildPostPayload(userId, usageId, title, description) {
  return {
    user_id: userId,
    daily_usage_id: usageId,
    title,
    description,
    images: [],
  };
}

async function ensureBuckets() {
  const bucketSpecs = [
    {
      id: "avatars",
      options: {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      },
    },
    {
      id: "post-images",
      options: {
        public: true,
        fileSizeLimit: 10485760,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      },
    },
  ];

  for (const bucket of bucketSpecs) {
    const { data: existing } = await supabase.storage.getBucket(bucket.id);
    if (existing) continue;

    const { error } = await supabase.storage.createBucket(
      bucket.id,
      bucket.options
    );
    if (error) throw error;
  }
}

async function main() {
  await ensureBuckets();

  const markId = await ensureUser(demoUsers[0]);
  const aliceId = await ensureUser(demoUsers[1]);

  const markUsage = buildUsageRows(markId, 1);
  const aliceUsage = buildUsageRows(aliceId, 0.7);

  const { data: usageRows, error: usageError } = await supabase
    .from("daily_usage")
    .upsert([...markUsage, ...aliceUsage], { onConflict: "user_id,date" })
    .select("id, user_id, date");

  if (usageError) throw usageError;

  const latestMarkUsage = usageRows
    ?.filter((row) => row.user_id === markId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const latestAliceUsage = usageRows
    ?.filter((row) => row.user_id === aliceId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);

  if (!latestMarkUsage || !latestAliceUsage) {
    throw new Error("Could not find seeded daily usage rows for demo posts.");
  }

  const { error: postsError } = await supabase.from("posts").upsert(
    [
      buildPostPayload(
        markId,
        latestMarkUsage.id,
        "Shipped a local-first Supabase setup",
        "Local Straude now runs against Docker-backed Supabase without production credentials."
      ),
      buildPostPayload(
        aliceId,
        latestAliceUsage.id,
        "Dialed in the consistency card",
        "Heatmap first, stats second, and a share flow that feels more like Strava than a screenshot."
      ),
    ],
    { onConflict: "daily_usage_id" }
  );

  if (postsError) throw postsError;

  console.log("Seeded local Straude demo data.");
  console.log("Demo users:");
  console.log("  mark@local.straude / password123");
  console.log("  alice@local.straude / password123");
  console.log("Suggested URLs:");
  console.log("  http://localhost:3000/u/mark");
  console.log("  http://localhost:3000/u/alice");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
