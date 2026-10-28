import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { loadWebEnv } from "./perf/env";

// These are local Auth fixtures, deliberately separate from the genuine
// installed-CLI-created account in packaged-cli-first-sync.spec.ts.
const env = loadWebEnv();
const configured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY);

function localDatabase() {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Settings E2E requires disposable loopback Supabase");
  }
  return createClient(url.href, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Fixture = { id: string; username: string; email: string; password: string; domain: string };

async function createFixture(): Promise<Fixture> {
  const db = localDatabase();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 14);
  const fixture = {
    id: randomUUID(), username: `settings_${suffix.slice(0, 10)}`,
    email: `settings-${suffix}@local.test`, password: `Settings-${randomUUID()}-Aa1!`,
    domain: `settings-${suffix}.example`,
  };
  const created = await db.auth.admin.createUser({
    id: fixture.id, email: fixture.email, password: fixture.password, email_confirm: true,
  });
  expect(created.error).toBeNull();
  try {
    expect((await db.from("users").upsert({
      id: fixture.id, username: fixture.username, is_public: true,
      onboarding_completed: false, timezone: "UTC",
    })).error).toBeNull();
    // A local negative cache avoids external favicon discovery. Profile writes
    // still run the real team validation/resolution and persistence path.
    expect((await db.from("team_favicon_cache").insert({
      domain: fixture.domain, object_path: null,
      retry_after: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })).error).toBeNull();
    return fixture;
  } catch (error) {
    await db.auth.admin.deleteUser(fixture.id);
    throw error;
  }
}

async function cleanup(fixture: Fixture) {
  const db = localDatabase();
  expect((await db.from("team_favicon_cache").delete().eq("domain", fixture.domain)).error).toBeNull();
  expect((await db.auth.admin.deleteUser(fixture.id)).error).toBeNull();
}

async function authenticate(context: BrowserContext, fixture: Fixture, baseURL: string) {
  expect(["localhost", "127.0.0.1"], "App must also be loopback").toContain(new URL(baseURL).hostname);
  const jar = new Map<string, string>();
  const member = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies: { name: string; value: string }[]) => {
        for (const { name, value } of cookies) jar.set(name, value);
      },
    },
  });
  const signed = await member.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  expect(signed.error).toBeNull();
  expect(signed.data.user?.id).toBe(fixture.id);
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL, sameSite: "Lax" })));
  return member;
}

async function openSettings(page: Page) {
  const response = await page.goto("/settings");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"], "Acceptance keeps the real CSP").toBeTruthy();
  await expect(page.getByLabel("Team", { exact: true })).toBeEnabled();
  const profile = await page.request.get("/api/users/me");
  expect(profile.status()).toBe(200);
  expect(profile.headers()["content-type"]).toContain("application/json");
}

async function save(page: Page) {
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/users/me" && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Save Changes", exact: true }).press("Enter");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  await expect(page.getByText("Saved successfully.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled();
  return response.json();
}

async function narrowLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const label of ["Display Name", "How did you hear about us?", "Team", "Timezone", "Public profile"]) {
    const control = page.getByLabel(label, { exact: true });
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box, `${label} has a rendered box`).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(361);
  }
}

test.describe("Settings persistence and privacy with real local Auth", () => {
  test.skip(!configured, "Local Supabase credentials are required");
  test.use({ viewport: { width: 360, height: 844 }, bypassCSP: false });

  test("failed save releases retry and preserves text, acquisition, timezone and team through reload and clear", async ({ page, baseURL }, testInfo) => {
    const fixture = await createFixture();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await authenticate(page.context(), fixture, baseURL!);
      await openSettings(page);
      const selected = await page.request.patch("/api/users/me", { data: { heard_about_sources: ["github", "friend_or_coworker"] } });
      expect(selected.status()).toBe(200);
      const display = page.getByLabel("Display Name", { exact: true });
      await display.focus();
      await page.keyboard.type("Settings keyboard fixture");
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Bio", { exact: true })).toBeFocused();
      await page.keyboard.type("Private fixture biography");
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("How did you hear about us?", { exact: true })).toBeFocused();
      await page.keyboard.type("A coworker shared GitHub");
      await page.getByLabel("Website", { exact: true }).fill("https://example.com/settings");
      await page.getByLabel("Timezone", { exact: true }).fill("America/New_York");
      await page.getByLabel("Team", { exact: true }).fill(`https://${fixture.domain}`);
      const retry = page.getByRole("button", { name: "Save Changes", exact: true });
      const abort = (route: Route) => route.request().method() === "PATCH" ? route.abort("failed") : route.continue();
      await page.route("**/api/users/me", abort);
      await retry.press("Enter");
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(retry).toBeEnabled();
      await expect(display).toHaveValue("Settings keyboard fixture");
      await page.unroute("**/api/users/me", abort);
      const html = (route: Route) => route.request().method() === "PATCH"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Temporary gateway failure</h1>" }) : route.continue();
      await page.route("**/api/users/me", html);
      await retry.press("Enter");
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(retry).toBeEnabled();
      await expect(display).toHaveValue("Settings keyboard fixture");
      await page.unroute("**/api/users/me", html);
      const saved = await save(page);
      expect(saved.id).toBe(fixture.id);
      expect(saved.heard_about_sources).toEqual(["friend_or_coworker", "github"]);
      await page.reload();
      for (const [label, value] of [
        ["Display Name", "Settings keyboard fixture"], ["Bio", "Private fixture biography"],
        ["How did you hear about us?", "A coworker shared GitHub"], ["Website", "https://example.com/settings"],
        ["Timezone", "America/New_York"], ["Team", `https://${fixture.domain}`],
      ]) await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
      const persisted = await page.request.get("/api/users/me");
      expect((await persisted.json()).heard_about_sources).toEqual(["friend_or_coworker", "github"]);
      await narrowLayout(page);
      await page.screenshot({ path: testInfo.outputPath("settings-persisted-360.png"), fullPage: true });
      for (const label of ["Display Name", "Bio", "How did you hear about us?", "Website"]) {
        await page.getByLabel(label, { exact: true }).fill("");
      }
      await save(page);
      await page.reload();
      for (const label of ["Display Name", "Bio", "How did you hear about us?", "Website"]) {
        await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
      }
      expect(errors).toEqual([]);
    } finally { await cleanup(fixture); }
  });

  test("failed clear-team restores keyboard retry and a real retry remains cleared after reload", async ({ page, baseURL }, testInfo) => {
    const fixture = await createFixture();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await authenticate(page.context(), fixture, baseURL!);
      await openSettings(page);
      await page.getByLabel("Team", { exact: true }).fill(`https://${fixture.domain}`);
      await save(page);
      await page.reload();
      const clear = page.getByRole("button", { name: "Clear team affiliation", exact: true });
      const abort = (route: Route) => route.request().method() === "PATCH" ? route.abort("failed") : route.continue();
      await page.route("**/api/users/me", abort);
      await clear.press("Enter");
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(clear).toBeEnabled();
      await expect(page.getByLabel("Team", { exact: true })).toHaveValue(`https://${fixture.domain}`);
      await page.unroute("**/api/users/me", abort);
      const html = (route: Route) => route.request().method() === "PATCH"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Temporary gateway failure</h1>" }) : route.continue();
      await page.route("**/api/users/me", html);
      await clear.press("Enter");
      await expect(clear).toBeEnabled();
      await expect(page.getByRole("alert")).toBeVisible();
      await page.unroute("**/api/users/me", html);
      const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/users/me") && response.request().method() === "PATCH");
      await clear.press("Enter");
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      expect((await response.json()).team_url).toBeNull();
      await expect(clear).toHaveCount(0);
      await page.reload();
      await expect(page.getByLabel("Team", { exact: true })).toHaveValue("");
      await expect(clear).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("settings-team-cleared-360.png"), fullPage: true });
      expect(errors).toEqual([]);
    } finally { await cleanup(fixture); }
  });

  test("next reads honor privacy after warming public surfaces and another account cannot edit the owner", async ({ browser, page, baseURL }, testInfo) => {
    const owner = await createFixture();
    const other = await createFixture();
    const anonymous = await browser.newContext({ baseURL, viewport: { width: 360, height: 844 }, bypassCSP: false });
    const outsider = await browser.newContext({ baseURL, bypassCSP: false });
    try {
      await authenticate(page.context(), owner, baseURL!);
      const member = await authenticate(outsider, other, baseURL!);
      await openSettings(page);
      await page.getByLabel("Bio", { exact: true }).fill("Only authorized readers see this fixture biography");
      await save(page);
      const publicPage = await anonymous.newPage();
      const surfaces = [`/api/users/${owner.username}`, `/api/users/${owner.username}/contributions`, `/api/users/${owner.username}/radar`];
      for (const surface of surfaces) {
        expect((await anonymous.request.get(surface)).status(), `warm ${surface}`).toBe(200);
        expect((await outsider.request.get(surface)).status(), `warm signed-in ${surface}`).toBe(200);
      }
      await publicPage.goto(`/u/${owner.username}`);
      await expect(publicPage.getByText("Only authorized readers see this fixture biography", { exact: true })).toBeVisible();
      const visibility = page.getByLabel("Public profile", { exact: true });
      await visibility.focus();
      await page.keyboard.press("Space");
      await expect(visibility).not.toBeChecked();
      await save(page);
      // No polling or cache-busting: the immediate next read of each warmed URL
      // must reject both anonymous and signed-in non-followers.
      for (const surface of surfaces) {
        const guest = await anonymous.request.get(surface);
        expect(guest.status(), `private ${surface}`).toBe(403);
        expect(await guest.json()).toEqual({ error: "Forbidden" });
        expect((await outsider.request.get(surface)).status()).toBe(403);
        expect((await page.request.get(surface)).status(), "owner retains access").toBe(200);
      }
      await publicPage.reload();
      await expect(publicPage.getByText("This profile is private", { exact: true })).toBeVisible();
      await expect(publicPage.getByText("Only authorized readers see this fixture biography", { exact: true })).toHaveCount(0);
      await expect(publicPage.getByRole("link", { name: "Edit Profile", exact: true })).toHaveCount(0);
      const targeted = await outsider.request.patch(`/api/users/me?id=${owner.id}`, {
        data: { id: owner.id, user_id: owner.id, display_name: "Other account update" },
      });
      expect(targeted.status()).toBe(200);
      expect((await targeted.json()).id).toBe(other.id);
      expect((await outsider.request.patch(`/api/users/${owner.username}`, { data: { bio: "Unauthorized change" } })).status()).toBe(405);
      const denied = await member.from("users").update({ bio: "Unauthorized direct change" }).eq("id", owner.id).select("id");
      expect(denied.error !== null || denied.data?.length === 0).toBe(true);
      const unchanged = await page.request.get("/api/users/me");
      const profile = await unchanged.json();
      expect(profile.id).toBe(owner.id);
      expect(profile.display_name).not.toBe("Other account update");
      expect(profile.bio).toBe("Only authorized readers see this fixture biography");
      expect(profile.is_public).toBe(false);
      await page.reload();
      await expect(visibility).not.toBeChecked();
      await publicPage.screenshot({ path: testInfo.outputPath("private-profile-next-read-360.png"), fullPage: true });
    } finally {
      await anonymous.close();
      await outsider.close();
      await cleanup(other);
      await cleanup(owner);
    }
  });
});
