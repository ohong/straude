export function loopbackHttpUrl(value: string | undefined): URL | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol)
    && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    && !url.username && !url.password ? url : null;
}

export function isLocalSupabaseImage(src: string): boolean {
  const api = loopbackHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!api) return false;
  const image = loopbackHttpUrl(src);
  return image?.origin === api.origin && image.pathname.startsWith("/storage/v1/object/");
}
