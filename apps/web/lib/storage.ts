export type StorageBucket = "avatars" | "post-images" | "dm-attachments";

export interface MessageAttachmentInput {
  bucket: "dm-attachments";
  path: string;
  name: string;
  type: string;
  size: number;
}

const DM_ATTACHMENT_BUCKET = "dm-attachments";

function getStorageOrigin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required to validate storage URLs");
  }
  return new URL(supabaseUrl).origin;
}

function getPublicStoragePrefix(bucket: StorageBucket) {
  return `/storage/v1/object/public/${bucket}/`;
}

function isValidStoragePath(path: string) {
  return path.length > 0 && !path.startsWith("/") && !path.includes("..");
}

export function isStoragePathOwnedByUser(path: string, userId: string): boolean {
  return isValidStoragePath(path) && path.startsWith(`${userId}/`);
}

function extractPublicStoragePath(
  url: string,
  bucket: StorageBucket,
): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== getStorageOrigin()) {
      return null;
    }

    const prefix = getPublicStoragePrefix(bucket);
    if (!parsed.pathname.startsWith(prefix)) {
      return null;
    }

    const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
    return isValidStoragePath(path) ? path : null;
  } catch {
    return null;
  }
}

export function isFirstPartyPublicStorageUrl(
  url: string,
  bucket: StorageBucket,
): boolean {
  return extractPublicStoragePath(url, bucket) !== null;
}

const ALLOWED_AVATAR_HOSTS = new Set([
  "avatars.githubusercontent.com",
  "unavatar.io",
  "api.dicebear.com",
]);

export function isAllowedAvatarUrl(url: string): boolean {
  if (
    isFirstPartyPublicStorageUrl(url, "avatars") ||
    isFirstPartyPublicStorageUrl(url, "post-images")
  ) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_AVATAR_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function normalizeMessageAttachmentInput(
  value: unknown,
): MessageAttachmentInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const name =
    typeof candidate.name === "string" && candidate.name.trim().length > 0
      ? candidate.name
      : null;
  const type =
    typeof candidate.type === "string" && candidate.type.trim().length > 0
      ? candidate.type
      : null;
  const size =
    typeof candidate.size === "number"
      && Number.isSafeInteger(candidate.size)
      && candidate.size >= 0
      ? candidate.size
      : null;

  if (!name || !type || size === null) {
    return null;
  }

  if (
    candidate.bucket === DM_ATTACHMENT_BUCKET &&
    typeof candidate.path === "string" &&
    isValidStoragePath(candidate.path)
  ) {
    return {
      bucket: DM_ATTACHMENT_BUCKET,
      path: candidate.path,
      name,
      type,
      size,
    };
  }

  if (typeof candidate.url === "string") {
    const path = extractPublicStoragePath(candidate.url, DM_ATTACHMENT_BUCKET);
    if (path) {
      return {
        bucket: DM_ATTACHMENT_BUCKET,
        path,
        name,
        type,
        size,
      };
    }
  }

  return null;
}
