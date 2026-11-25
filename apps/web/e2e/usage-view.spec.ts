import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createHash, randomUUID } from "node:crypto";
import { loadWebEnv } from "./perf/env";

const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

const hash = (seed: string) => createHash("sha256").update(seed).digest("hex");

const tokens = (input: number, output: number, reasoning: number, cacheCreation: number, cacheRead: number) => ({
  input_tokens: input,
  output_tokens: output,
  reasoning_output_tokens: reasoning,
  cache_creation_tokens: cacheCreation,
  cache_read_tokens: cacheRead,
  total_tokens: input + output + reasoning + cacheCreation + cacheRead,
});

const breakdownEntry = (
  model: string,
  t: ReturnType<typeof tokens>,
  cost: number,
) => ({
  model,
  input_tokens: t.input_tokens,
  output_tokens: t.output_tokens,
  reasoning_output_tokens: t.reasoning_output_tokens,
  cache_creation_tokens: t.cache_creation_tokens,
  cache_read_tokens: t.cache_read_tokens,
  cost_usd: cost,
});

test("usage view aggregates spend and tokens by tool, model and day", { tag: "@core" }, async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const env = loadWebEnv();
  for (const url of [env.NEXT_PUBLIC_SUPABASE_URL, baseURL]) {
    if (!url || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)) {
      throw new Error("Usage view E2E requires loopback app and Supabase URLs.");
    }
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = randomUUID();
  const deviceId = randomUUID();
  const email = `usage-${userId}@example.test`;
  const password = randomUUID();
  const username = `usage_${userId.slice(0, 8)}`;
  let context: Awaited<ReturnType<typeof browser.newContext>> | null = null;

  try {
    expect((await admin.auth.admin.createUser({ id: userId, email, password, email_confirm: true })).error).toBeNull();
    expect((await admin.from("users").upsert({
      id: userId, username, display_name: "Usage Test", is_public: false,
      onboarding_completed: true, timezone: "UTC",
    })).error).toBeNull();

    const claudeTokens = tokens(1000, 500, 0, 200, 8300);
    const codexRecentTokens = tokens(2000, 1000, 500, 0, 16500);
    const codexOlderTokens = tokens(5000, 0, 0, 0, 0);
    const legacyTokens = tokens(100, 100, 300, 0, 0);
    const rows = [
      {
        user_id: userId, date: today, device_id: deviceId, agent: "claude",
        models: ["claude-opus-5-5"], ...claudeTokens, cost_usd: 12.5,
        model_breakdown: [breakdownEntry("claude-opus-5-5", claudeTokens, 12.5)],
        content_hash: hash("usage-view-claude"), collector: {},
      },
      {
        user_id: userId, date: shift(today, -1), device_id: deviceId, agent: "codex",
        models: ["gpt-6.2-sol"], ...codexRecentTokens, cost_usd: 30,
        model_breakdown: [breakdownEntry("gpt-6.2-sol", codexRecentTokens, 30)],
        content_hash: hash("usage-view-codex-recent"), collector: {},
      },
      {
        user_id: userId, date: shift(today, -10), device_id: deviceId, agent: "codex",
        models: ["gpt-6.2-sol"], ...codexOlderTokens, cost_usd: 7.25,
        model_breakdown: [breakdownEntry("gpt-6.2-sol", codexOlderTokens, 7.25)],
        content_hash: hash("usage-view-codex-older"), collector: {},
      },
      {
        user_id: userId, date: shift(today, -40), device_id: deviceId, agent: "legacy-unpartitioned",
        models: ["claude-sonnet-5"], ...legacyTokens, cost_usd: 5,
        model_breakdown: [{ model: "claude-sonnet-5", cost_usd: 4 }],
        content_hash: hash("usage-view-legacy"), collector: {},
      },
    ];
    expect((await admin.from("usage_agent_daily").insert(rows)).error).toBeNull();

    const jar = new Map<string, string>();
    const db = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies: { name: string; value: string }[]) => {
          for (const cookie of cookies) jar.set(cookie.name, cookie.value);
        },
      },
    });
    expect((await db.auth.signInWithPassword({ email, password })).error).toBeNull();
    context = await browser.newContext({ baseURL });
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL!, sameSite: "Lax" })));

    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/usage");

    const hero = page.locator("p.text-4xl");
    await expect(hero).toHaveText("$49.75");
    await expect(page.getByText(/3 active days/)).toBeVisible();

    const codexRow = page.locator("dl").filter({ hasText: "Codex" });
    await expect(codexRow).toContainText("$37.25");
    const claudeRow = page.locator("dl").filter({ hasText: "Claude Code" });
    await expect(claudeRow).toContainText("$12.50");

    const totals = page.locator("dl").filter({ hasText: "Processed tokens" });
    await expect(totals).toContainText("35.0k");
    await expect(totals).toContainText("24.8k");
    await expect(totals).toContainText("8.0k");
    await expect(totals).toContainText("2.0k");
    await expect(totals).toContainText("75.2%");

    const modelTable = page.getByRole("table");
    const firstModelRow = modelTable.getByRole("row").nth(1);
    await expect(firstModelRow).toContainText("gpt-6.2-sol");
    await expect(firstModelRow).toContainText("$37.25");
    await expect(firstModelRow).toContainText("74.9%");

    await page.getByRole("button", { name: "7 days", exact: true }).click();
    await expect(hero).toHaveText("$42.50");
    await expect(page.getByText(/2 active days/)).toBeVisible();

    await page.getByRole("button", { name: "90 days", exact: true }).click();
    await expect(hero).toHaveText("$54.75");
    const legacyRow = page.locator("dl").filter({ hasText: "Earlier syncs" });
    await expect(legacyRow).toContainText("$5.00");
    await expect(
      modelTable.getByRole("row").filter({ hasText: "claude-sonnet-5" }),
    ).toContainText("$4.00");
    await expect(
      modelTable.getByRole("row").filter({ hasText: "Unattributed" }),
    ).toContainText("$1.00");

    await page.getByRole("button", { name: "Tokens", exact: true }).click();
    await expect(hero).toHaveText("35.5k");
    await expect(page).toHaveURL(/range=90&metric=tokens/);

    await page.getByLabel("Tool").selectOption("codex");
    await expect(hero).toHaveText("25.0k");

    await page.getByRole("button", { name: "Day", exact: true }).click();
    const dayRegion = page.getByRole("region", { name: "Usage breakdown by day" });
    await expect(dayRegion).toBeVisible();
    await expect(
      dayRegion.getByRole("row").filter({ hasText: dayLabel(shift(today, -1)) }),
    ).toBeVisible();

    const anonContext = await browser.newContext({ baseURL });
    try {
      const anonPage = await anonContext.newPage();
      await anonPage.goto("/usage");
      await expect(anonPage).toHaveURL(/\/login/);
    } finally {
      await anonContext.close();
    }
  } finally {
    await context?.close();
    expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});
