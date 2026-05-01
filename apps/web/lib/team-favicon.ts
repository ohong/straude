import { getServiceClient } from "@/lib/supabase/service";

const BUCKET = "team-favicons" as const;
const FAVICON_SIZE = 128;
const FETCH_TIMEOUT_MS = 5000;

export type ResolveTeamFaviconResult =
  | {
      ok: true;
      teamUrl: string;
      teamFaviconUrl: string | null;
    }
  | {
      ok: false;
      error: "invalid_url";
    };

function parseTeamUrl(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return parsed;
}

async function isFaviconCached(publicUrl: string): Promise<boolean> {
  try {
    const res = await fetch(publicUrl, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchFaviconBytes(domain: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${FAVICON_SIZE}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validate a user-supplied team URL, ensure a favicon is cached in the
 * `team-favicons` Storage bucket (object key: `<domain>.png`), and return
 * the normalized team URL plus the public favicon URL. Server-only.
 *
 * If the favicon fetch or upload fails, the team URL is still returned with
 * `teamFaviconUrl: null` so the caller can persist the URL and render a
 * generic icon — better UX than blocking the save flow on a third-party.
 */
export async function resolveTeamFavicon(
  rawUrl: string,
): Promise<ResolveTeamFaviconResult> {
  const parsed = parseTeamUrl(rawUrl);
  if (!parsed) {
    return { ok: false, error: "invalid_url" };
  }

  const teamUrl = parsed.origin;
  const domain = parsed.hostname.toLowerCase();
  const objectPath = `${domain}.png`;

  const supabase = getServiceClient();
  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(objectPath);
  const publicUrl = publicData?.publicUrl ?? null;

  if (publicUrl && (await isFaviconCached(publicUrl))) {
    return { ok: true, teamUrl, teamFaviconUrl: publicUrl };
  }

  const bytes = await fetchFaviconBytes(domain);
  if (!bytes) {
    return { ok: true, teamUrl, teamFaviconUrl: null };
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, new Uint8Array(bytes), {
      contentType: "image/png",
      upsert: true,
    });
  if (uploadError || !publicUrl) {
    return { ok: true, teamUrl, teamFaviconUrl: null };
  }

  return { ok: true, teamUrl, teamFaviconUrl: publicUrl };
}
