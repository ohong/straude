import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "./env";

export function createClient() {
  const env = getSupabaseBrowserEnv();
  return createBrowserClient(
    env.url,
    env.publishableKey
  );
}
