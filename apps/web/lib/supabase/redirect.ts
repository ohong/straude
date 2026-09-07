/** Keep auth return paths local, including after URL decoding and normalization. */
export function safeAuthNext(value: string | null): string | null {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;

  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(decoded)
    ) return null;

    const base = "https://straude.invalid";
    if (new URL(value, base).origin !== base) return null;
    return value;
  } catch {
    return null;
  }
}

export function authPathWithNext(path: string, next: string | null): string {
  const safeNext = safeAuthNext(next);
  return safeNext ? `${path}?${new URLSearchParams({ next: safeNext })}` : path;
}
