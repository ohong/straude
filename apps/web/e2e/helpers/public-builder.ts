import { test as base, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadWebEnv } from "../perf/env";

type PublicBuilder = { username: string; teamHost: string };

export const test = base.extend<object, { publicBuilder: PublicBuilder }>({
  publicBuilder: [async ({}, runTest) => {
    const env = loadWebEnv();
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error("Public profile fixtures require disposable loopback Supabase.");
    }
    const db = createClient(url.href, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const id = randomUUID();
    const username = `builder_${id.slice(0, 8)}`;
    const teamHost = `${username.replace("_", "-")}.example`;
    const created = await db.auth.admin.createUser({ id, email: `${username}@example.test`, email_confirm: true });
    expect(created.error).toBeNull();
    try {
      const profile = await db.from("users").update({
        username, display_name: null, timezone: "UTC", is_public: true, onboarding_completed: true, team_url: `https://${teamHost}`,
      }).eq("id", id).select("id").single();
      // A real signup must create the profile that onboarding updates.
      expect(profile.error).toBeNull();
      expect((await db.from("daily_usage").insert({
        user_id: id, date: new Date().toISOString().slice(0, 10), cost_usd: 123.45,
        input_tokens: 100, output_tokens: 100, total_tokens: 200, session_count: 1,
        models: ["fixture"], is_verified: true,
      })).error).toBeNull();
      expect((await db.from("user_achievements").upsert({
        user_id: id, achievement_slug: "first-sync",
      }, { onConflict: "user_id,achievement_slug" })).error).toBeNull();
      await runTest({ username, teamHost });
    } finally {
      expect((await db.auth.admin.deleteUser(id)).error).toBeNull();
    }
  }, { scope: "worker" }],
});
export { expect };
