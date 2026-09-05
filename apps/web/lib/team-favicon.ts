import { getServiceClient } from "@/lib/supabase/service";
import { discoverFavicon } from "@/lib/favicons/discover";
import { publicHttpUrl } from "@/lib/favicons/public-fetch";

const BUCKET = "team-favicons";
const NEGATIVE_CACHE_MS = 15 * 60 * 1000;

export type ResolveTeamFaviconResult =
  | { ok: true; teamUrl: string; teamFaviconUrl: string | null }
  | { ok: false; error: "invalid_url" };

export function normalizeTeamUrl(rawUrl: string): string | null {
  return publicHttpUrl(rawUrl.trim())?.origin ?? null;
}

export async function resolveTeamFavicon(rawUrl: string): Promise<ResolveTeamFaviconResult> {
  const teamUrl = normalizeTeamUrl(rawUrl);
  if (!teamUrl) return { ok: false, error: "invalid_url" };
  const fallback = { ok: true, teamUrl, teamFaviconUrl: null } satisfies ResolveTeamFaviconResult;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const domain = new URL(teamUrl).hostname.toLowerCase();
    const db = getServiceClient(controller.signal);
    const bucket = db.storage.from(BUCKET);
    const { data: cached } = await db.from("team_favicon_cache")
      .select("object_path,retry_after").eq("domain", domain).maybeSingle();
    if (cached?.object_path && typeof cached.object_path === "string") {
      return { ok: true, teamUrl, teamFaviconUrl: bucket.getPublicUrl(cached.object_path).data.publicUrl };
    }
    if (cached?.retry_after && new Date(cached.retry_after).getTime() > Date.now()) return fallback;

    // Existing PNGs remain valid without a refresh or a metadata backfill migration.
    const legacyPath = `${domain}.png`;
    const { data: legacyExists } = await bucket.exists(legacyPath);
    if (legacyExists) {
      await db.from("team_favicon_cache").upsert({ domain, object_path: legacyPath, retry_after: null });
      return { ok: true, teamUrl, teamFaviconUrl: bucket.getPublicUrl(legacyPath).data.publicUrl };
    }

    const favicon = await discoverFavicon(new URL(teamUrl), controller.signal);
    if (!favicon) {
      const miss = { domain, object_path: null, retry_after: new Date(Date.now() + NEGATIVE_CACHE_MS).toISOString() };
      // A slower failed lookup cannot overwrite a concurrent successful result.
      await db.from("team_favicon_cache").upsert(miss, { ignoreDuplicates: true });
      await db.from("team_favicon_cache").update({ retry_after: miss.retry_after })
        .eq("domain", domain).is("object_path", null);
      return fallback;
    }
    const objectPath = `${domain}.${favicon.format}`;
    const { error } = await bucket.upload(objectPath, favicon.bytes, {
      contentType: favicon.format === "svg" ? "image/svg+xml" : "image/png",
      upsert: true,
    });
    if (error) return fallback;
    await db.from("team_favicon_cache").upsert({ domain, object_path: objectPath, retry_after: null });
    return { ok: true, teamUrl, teamFaviconUrl: bucket.getPublicUrl(objectPath).data.publicUrl };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
