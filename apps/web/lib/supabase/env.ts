const BROWSER_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const SERVER_ENV_KEYS = ["SUPABASE_SECRET_KEY"] as const;

type BrowserEnvKey = (typeof BROWSER_ENV_KEYS)[number];
type ServerEnvKey = (typeof SERVER_ENV_KEYS)[number];

function getMissing(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key] || process.env[key]?.trim() === "");
}

export function getMissingSupabaseBrowserEnv(): BrowserEnvKey[] {
  return getMissing(BROWSER_ENV_KEYS) as BrowserEnvKey[];
}

export function getMissingSupabaseServerEnv(): ServerEnvKey[] {
  return getMissing(SERVER_ENV_KEYS) as ServerEnvKey[];
}

export function hasSupabaseBrowserEnv() {
  return getMissingSupabaseBrowserEnv().length === 0;
}

export function hasSupabaseServerEnv() {
  return getMissingSupabaseServerEnv().length === 0;
}

export function formatSupabaseEnvHelp(missing: readonly string[]) {
  const joined = missing.map((key) => `- ${key}`).join("\n");
  return [
    "Local Supabase is not configured for this app.",
    "",
    "Missing environment variables:",
    joined,
    "",
    "Recommended local workflow:",
    "1. `bun run local:up`",
    "2. `bun run local:env`",
    "3. `bun run local:seed`",
    "4. `bun run dev:local`",
    "",
    "Or open `/dev/local-env` for the full setup guide.",
  ].join("\n");
}

export function getSupabaseBrowserEnv() {
  const missing = getMissingSupabaseBrowserEnv();
  if (missing.length > 0) {
    throw new Error(formatSupabaseEnvHelp(missing));
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}

export function getSupabaseServerEnv() {
  const missing = [
    ...getMissingSupabaseBrowserEnv(),
    ...getMissingSupabaseServerEnv(),
  ];

  if (missing.length > 0) {
    throw new Error(formatSupabaseEnvHelp(missing));
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    secretKey: process.env.SUPABASE_SECRET_KEY!,
  };
}
