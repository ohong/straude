"use client";

import { useEffect } from "react";

export function RefCookie({ username }: { username: string }) {
  useEffect(() => {
    document.cookie = `ref=${encodeURIComponent(username)}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
  }, [username]);

  return null;
}
