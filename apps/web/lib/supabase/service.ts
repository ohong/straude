import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "./env";

export function getServiceClient(signal?: AbortSignal) {
  const env = getSupabaseServerEnv();
  return createServiceClient(
    env.url,
    env.secretKey,
    signal ? { global: { fetch: (input, init) => fetch(input, { ...init, signal }) } } : undefined,
  );
}
