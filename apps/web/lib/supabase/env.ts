const BROWSER_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const SERVER_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
] as const;

type BrowserEnvKey = (typeof BROWSER_ENV_KEYS)[number];
type ServerEnvKey = (typeof SERVER_ENV_KEYS)[number];

const browserEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
} as const;

const serverEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "",
} as const;

function getMissing(
  keys: readonly string[],
  values: Record<string, string>
) {
  return keys.filter((key) => {
    const value = values[key];
    return !value || value.trim() === "";
  });
}

export function getMissingSupabaseBrowserEnv(): BrowserEnvKey[] {
  return getMissing(BROWSER_ENV_KEYS, browserEnv) as BrowserEnvKey[];
}

function getMissingSupabaseServerEnv(): ServerEnvKey[] {
  return getMissing(SERVER_ENV_KEYS, serverEnv) as ServerEnvKey[];
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
    url: browserEnv.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: browserEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getSupabaseServerEnv() {
  const missing = getMissingSupabaseServerEnv();

  if (missing.length > 0) {
    throw new Error(formatSupabaseEnvHelp(missing));
  }

  return {
    url: serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: serverEnv.SUPABASE_SECRET_KEY,
  };
}
