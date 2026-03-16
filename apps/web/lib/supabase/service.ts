import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "./env";

export function getServiceClient() {
  const env = getSupabaseServerEnv();
  return createServiceClient(
    env.url,
    env.secretKey,
  );
}
