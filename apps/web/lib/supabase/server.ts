import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseBrowserEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  const env = getSupabaseBrowserEnv();
  type CookieOptions = Parameters<typeof cookieStore.set>[2];
  return createServerClient(
    env.url,
    env.publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
