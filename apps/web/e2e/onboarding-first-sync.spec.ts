import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { createClient, type Session } from "@supabase/supabase-js";
import { test, expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

type LocalEnv = {
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  skipReason?: string;
};

type LocalUser = {
  id: string;
  email: string;
  password: string;
  usage?: {
    id: string;
    cost_usd: number;
    total_tokens: number;
    session_count: number;
    top_model: string;
    latest_usage_date: string;
  };
};

function parseEnvFile(path: string): Map<string, string> {
  try {
    return new Map(
      readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("#"))
        .flatMap((line) => {
          const separator = line.indexOf("=");
          if (separator < 0) return [];
          const key = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, "$1");
          return [[key, value] as const];
        }),
    );
  } catch {
    return new Map();
  }
}

function readLocalEnv(): LocalEnv {
  const fileEnv = parseEnvFile(resolve(process.cwd(), ".env.local"));
  const value = (key: string) => process.env[key] || fileEnv.get(key) || "";
  const supabaseUrl = value("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = value("SUPABASE_SECRET_KEY");

  // CI often supplies placeholder values so unrelated browser tests can run.
  // Do not turn those placeholders into a live Supabase call.
  const isPlaceholder = (candidate: string) =>
    /(?:placeholder|dummy|changeme|replace[_ -]?me|your[_ -]?key|example(?:\.com)?|^test(?:[-_]|$))/i.test(candidate);

  if (!supabaseUrl || !publishableKey || !secretKey || [supabaseUrl, publishableKey, secretKey].some(isPlaceholder)) {
    return {
      supabaseUrl,
      publishableKey,
      secretKey,
      skipReason:
      "Skipped: local Supabase URL, publishable key, and secret key are required.",
    };
  }

  if (!isLoopbackUrl(supabaseUrl)) {
    return {
      supabaseUrl,
      publishableKey,
      secretKey,
      skipReason:
        `Refusing onboarding E2E against non-loopback Supabase URL ${supabaseUrl}.`,
    };
  }

  return { supabaseUrl, publishableKey, secretKey };
}

function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const env = readLocalEnv();

function adminClient() {
  return createClient(env.supabaseUrl, env.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function createLocalUser(withUsage = false): Promise<LocalUser> {
  const admin = adminClient();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const email = `onboarding-e2e-${suffix}@local.test`;
  const password = `E2E-${randomUUID()}-Aa1!`;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    throw new Error(`Could not create local E2E user: ${authError?.message ?? "missing user"}`);
  }

  const { error: profileError } = await admin.from("users").upsert(
    {
      id: authData.user.id,
      is_public: true,
      onboarding_completed: false,
      timezone: "UTC",
    },
    { onConflict: "id" },
  );
  if (profileError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(authData.user.id);
    throw new Error(
      [
        `Could not create local E2E profile: ${profileError.message}`,
        cleanupError ? `Cleanup also failed: ${cleanupError.message}` : "",
      ].filter(Boolean).join(" "),
    );
  }

  const user: LocalUser = { id: authData.user.id, email, password };
  if (withUsage) {
    const usage = {
      user_id: user.id,
      date: new Date().toISOString().slice(0, 10),
      cost_usd: 12.34,
      input_tokens: 1_000,
      output_tokens: 234,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 1_234,
      models: ["gpt-5.6-terra"],
      session_count: 2,
      is_verified: true,
      raw_hash: `onboarding-e2e-${user.id}`,
    };
    const { data: usageRow, error: usageError } = await admin
      .from("daily_usage")
      .insert(usage)
      .select("id,date,cost_usd,total_tokens,session_count,models")
      .single();
    if (usageError || !usageRow) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(user.id);
      throw new Error(
        [
          `Could not seed local E2E usage: ${usageError?.message ?? "missing row"}`,
          cleanupError ? `Cleanup also failed: ${cleanupError.message}` : "",
        ].filter(Boolean).join(" "),
      );
    }
    user.usage = {
      id: usageRow.id,
      cost_usd: Number(usageRow.cost_usd),
      total_tokens: Number(usageRow.total_tokens),
      session_count: Number(usageRow.session_count),
      top_model: Array.isArray(usageRow.models) ? String(usageRow.models[0]) : "gpt-5.6-terra",
      latest_usage_date: usageRow.date,
    };
  }

  return user;
}

async function deleteLocalUser(user: LocalUser): Promise<void> {
  // The auth FK cascades to public.users and its usage/post rows. This targets
  // only the unique user created by the current test.
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Could not clean local E2E user ${user.id}: ${error.message}`);
}

async function signInAndSetSsrCookies(
  context: BrowserContext,
  user: LocalUser,
  appOrigin: string,
): Promise<void> {
  const client = createClient(env.supabaseUrl, env.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session) {
    throw new Error(`Could not sign in local E2E user: ${error?.message ?? "missing session"}`);
  }

  const session = data.session as Session;
  const storageKey = `sb-${new URL(env.supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const encoded = `base64-${stringToBase64URL(JSON.stringify(session))}`;
  await context.addCookies(
    createChunks(storageKey, encoded).map(({ name, value }) => ({
      name,
      value,
      url: appOrigin,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}

function projectBaseUrl(testInfo: TestInfo): string {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string" || !baseURL) {
    throw new Error("Playwright project must provide a loopback baseURL for onboarding E2E.");
  }
  return baseURL;
}

async function openOnboarding(page: Page, user: LocalUser, testInfo: TestInfo): Promise<void> {
  await signInAndSetSsrCookies(page.context(), user, projectBaseUrl(testInfo));
  const response = await page.goto("/onboarding");
  expect(response?.status(), "authenticated onboarding page should load").toBe(200);
}

async function expectIncompleteProfile(user: LocalUser): Promise<void> {
  const { data, error } = await adminClient()
    .from("users")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();
  expect(error).toBeNull();
  expect(data?.onboarding_completed).toBe(false);
}

test.describe("first-sync onboarding", () => {
  test.beforeEach(({}, testInfo) => {
    if (env.skipReason?.startsWith("Refusing")) {
      throw new Error(env.skipReason);
    }
    const appOrigin = projectBaseUrl(testInfo);
    if (!isLoopbackUrl(appOrigin)) {
      throw new Error(`Refusing onboarding E2E against non-loopback app URL ${appOrigin}.`);
    }
    test.skip(Boolean(env.skipReason), env.skipReason);
  });

  test("shows the command immediately and skip keeps activation incomplete", async ({ page }, testInfo) => {
    const user = await createLocalUser();
    try {
      await openOnboarding(page, user, testInfo);
      await expect(page.locator("#sync-command")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sync your first session" })).toBeVisible();
      await expect(page.getByText("Claim your handle")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Explore without syncing" })).toBeVisible();

      await page.screenshot({ path: testInfo.outputPath("onboarding-command-desktop.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: testInfo.outputPath("onboarding-command-mobile.png"), fullPage: true });

      await page.getByRole("button", { name: "Explore without syncing" }).click();
      await expect(page).toHaveURL(/\/feed$/);
      await expectIncompleteProfile(user);
    } finally {
      await deleteLocalUser(user);
    }
  });

  test("moves from waiting to real stats and completes onboarding", async ({ page }, testInfo) => {
    const user = await createLocalUser(true);
    try {
      let statusCalls = 0;
      await page.route("**/api/usage/status", async (route) => {
        statusCalls += 1;
        if (statusCalls === 1) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ has_data: false, has_usage: false }),
          });
          return;
        }
        await route.continue();
      });

      const patchResponse = page.waitForResponse((response) =>
        response.url().endsWith("/api/users/me") && response.request().method() === "PATCH",
      );
      await openOnboarding(page, user, testInfo);
      await expect(page.getByText("Waiting for your first sync. This page checks automatically.")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your first sync is complete" })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("$12.34")).toBeVisible();
      await expect(page.getByText("234", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Go to your feed" })).toBeVisible();
      expect((await patchResponse).status()).toBe(200);

      const { data: profile, error } = await adminClient()
        .from("users")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();
      expect(error).toBeNull();
      expect(profile?.onboarding_completed).toBe(true);
      expect(statusCalls).toBeGreaterThanOrEqual(2);
    } finally {
      await deleteLocalUser(user);
    }
  });

  test("shows completion failure and retries setup", async ({ page }, testInfo) => {
    const user = await createLocalUser(true);
    try {
      let patchAttempts = 0;
      await page.route("**/api/users/me", async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.continue();
          return;
        }
        patchAttempts += 1;
        if (patchAttempts === 1) {
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Temporary setup failure" }),
          });
          return;
        }
        await route.continue();
      });

      await openOnboarding(page, user, testInfo);
      await expect(page.getByText("Temporary setup failure", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Retry setup" })).toBeVisible();
      await expectIncompleteProfile(user);

      await page.getByRole("button", { name: "Retry setup" }).click();
      await expect(page.getByRole("heading", { name: "Your first sync is complete" })).toBeVisible();
      expect(patchAttempts).toBe(2);

      const { data: profile, error } = await adminClient()
        .from("users")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();
      expect(error).toBeNull();
      expect(profile?.onboarding_completed).toBe(true);
    } finally {
      await deleteLocalUser(user);
    }
  });
});
