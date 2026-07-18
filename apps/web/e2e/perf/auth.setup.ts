import { test as setup, expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUTH_STATE_PATH, TARGETS_PATH, loadWebEnv } from "./env";

// Signs in the perf test user programmatically and saves the session as a
// Playwright storageState. Uses @supabase/ssr's own server client with an
// in-memory cookie jar so the cookie format (base64 + chunking) is produced
// by the library itself, not reimplemented here.
setup("authenticate perf user and discover targets", async () => {
  const env = loadWebEnv();
  const email = env.PERF_TEST_EMAIL;
  const password = env.PERF_TEST_PASSWORD;
  expect(email, "PERF_TEST_EMAIL missing from apps/web/.env.local").toBeTruthy();
  expect(password, "PERF_TEST_PASSWORD missing from apps/web/.env.local").toBeTruthy();

  const jar = new Map<string, string>();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (cookies: { name: string; value: string }[]) => {
          for (const { name, value } of cookies) jar.set(name, value);
        },
      },
    }
  );

  const { data: signIn, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  expect(error, `sign-in failed: ${error?.message}`).toBeNull();
  expect(jar.size, "no auth cookies were written").toBeGreaterThan(0);

  const storageState = {
    cookies: [...jar.entries()].map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
    origins: [],
  };

  // Discover measurement targets with the signed-in client (RLS applies):
  // a busy public profile and a recent post, so /u/... and /post/... are
  // measured against realistic data rather than the empty perf account.
  const [{ data: topUser }, { data: recentPost }] = await Promise.all([
    supabase
      .from("leaderboard_weekly")
      .select("username")
      .order("total_cost", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("posts")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  expect(topUser?.username, "could not find a leaderboard profile target").toBeTruthy();
  expect(recentPost?.id, "could not find a post target").toBeTruthy();

  mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
  writeFileSync(AUTH_STATE_PATH, JSON.stringify(storageState, null, 2));
  writeFileSync(
    TARGETS_PATH,
    JSON.stringify(
      {
        profileUsername: topUser!.username,
        postId: recentPost!.id,
        perfUserId: signIn.user?.id,
      },
      null,
      2
    )
  );
});
