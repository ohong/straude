import { execFileSync } from "node:child_process";

export function parseEnv(raw) {
  return new Map(raw.split(/\r?\n/).flatMap((line) => {
    const entry = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!entry) return [];
    const [, key, rawValue] = entry;
    return [[key, rawValue.trim().replace(/^(['"])(.*)\1$/, "$2")]];
  }));
}

export function readLegacyStatus(repoRoot) {
  return execFileSync("bunx", ["--package", "supabase@2.75.0", "supabase", "status", "-o", "env"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function assertLocalUrl(value, label, protocols) {
  const url = value && URL.canParse(value) ? new URL(value) : null;
  if (!url || !protocols.includes(url.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error(`${label} must be a loopback ${protocols.join(" or ")} URL.`);
  }
  return url;
}

export function localSupabaseEndpoints(status) {
  const apiUrl = status.get("NEXT_PUBLIC_SUPABASE_URL") || status.get("API_URL") || "";
  const dbUrl = status.get("DB_URL") || "";
  const mailUrl = status.get("MAILPIT_URL") || status.get("INBUCKET_URL") || "";
  const publishableKey = status.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    || status.get("PUBLISHABLE_KEY") || status.get("ANON_KEY") || "";
  const secretKey = status.get("SUPABASE_SECRET_KEY")
    || status.get("SECRET_KEY") || status.get("SERVICE_ROLE_KEY") || "";

  const api = assertLocalUrl(apiUrl, "Supabase API", ["http:", "https:"]);
  const database = assertLocalUrl(dbUrl, "Supabase database", ["postgres:", "postgresql:"]);
  if (database.search || database.hash) {
    throw new Error("Use the direct Supabase database URL from local stack status.");
  }
  if (mailUrl) assertLocalUrl(mailUrl, "Supabase mail", ["http:", "https:"]);
  const storageUrl = new URL("/storage/v1", api).href;
  const storageS3Url = status.get("STORAGE_S3_URL") || "";
  if (storageS3Url) assertLocalUrl(storageS3Url, "Supabase S3", ["http:", "https:"]);

  if (!publishableKey || !secretKey) {
    throw new Error("Supabase status must supply a publishable key and a secret key.");
  }

  return { apiUrl, dbUrl, mailUrl, storageUrl, storageS3Url, publishableKey, secretKey };
}
