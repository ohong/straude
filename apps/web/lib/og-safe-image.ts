import { isAllowedAvatarUrl, isFirstPartyPublicStorageUrl } from "@/lib/storage";

// Satori (next/og) only decodes PNG, JPEG, and GIF. User-uploaded images can
// be webp/avif regardless of file extension, which makes the whole OG image
// render throw. Fetch the image, sniff its real format from magic bytes, and
// return a data URI satori can decode — or null so callers fall back to their
// no-image layout.
//
// Both loaders fetch a URL that ultimately comes from user-controlled columns
// (`users.avatar_url` is written verbatim by PATCH /api/users/me), so each one
// applies the same allowlist the sibling /api/posts/[id]/share-image route
// applies before handing a URL to satori. Anything outside the allowlist is
// never fetched.

/** Satori decodes nothing larger than this comfortably, and a data URI costs
 *  ~4/3 of the raw bytes in memory. Real avatars/hero images are well under. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** OG cards are rendered on request; a slow third-party host must not hold the
 *  function open until the platform timeout kills the whole render. */
const FETCH_TIMEOUT_MS = 3_000;

/** Avatars may live in first-party storage or on the three avatar CDNs the
 *  profile flow accepts. */
export function loadSafeOgAvatar(
  url: string | null | undefined,
): Promise<string | null> {
  return loadSafeOgImage(url, isAllowedAvatarUrl);
}

/** Post hero images are only ever uploaded to the post-images bucket. */
export function loadSafeOgPostImage(
  url: string | null | undefined,
): Promise<string | null> {
  return loadSafeOgImage(url, (candidate) =>
    isFirstPartyPublicStorageUrl(candidate, "post-images"),
  );
}

async function loadSafeOgImage(
  url: string | null | undefined,
  isAllowed: (url: string) => boolean,
): Promise<string | null> {
  if (typeof url !== "string" || !url || !isAllowed(url)) return null;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const declaredLength = Number(res.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    // Re-check: content-length is advisory and absent on chunked responses.
    if (buf.byteLength > MAX_IMAGE_BYTES) return null;

    const mime = sniffMime(buf);
    if (!mime) return null;

    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46)
    return "image/gif";
  return null;
}
