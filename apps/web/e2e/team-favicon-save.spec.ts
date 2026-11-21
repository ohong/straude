import { test as base, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import { loadWebEnv } from "./perf/env";

type FaviconFormat = "svg" | "png";
type CachedIcons = Record<FaviconFormat, { domain: string; objectPath: string }>;

const test = base.extend<object, { cachedIcons: CachedIcons }>({
  cachedIcons: [async ({}, use) => {
    const env = loadWebEnv();
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Favicon fixtures require local Supabase");
    const db = createClient(url.href, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    const bucket = db.storage.from("team-favicons");
    const id = crypto.randomUUID();
    const icons = {
      svg: { domain: `svg-${id}.example`, objectPath: `svg-${id}.example.svg` },
      png: { domain: `png-${id}.example`, objectPath: `png-${id}.example.png` },
    };
    const created: string[] = [];
    try {
      // Keep both objects until the worker finishes. The local Storage backend
      // removes empty parent directories when it deletes the last object.
      for (const format of ["svg", "png"] as const) {
        const bytes = format === "svg"
          ? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64" width="128" height="64"><rect width="128" height="64" fill="#DF561F"/></svg>')
          : await sharp({ create: { width: 128, height: 64, channels: 4, background: "#DF561F" } }).png().toBuffer();
        const { error } = await bucket.upload(icons[format].objectPath, bytes, {
          contentType: format === "svg" ? "image/svg+xml" : "image/png",
        });
        if (error) {
          console.error("Local favicon upload failed", format, error.name, error.message);
          throw error;
        }
        created.push(icons[format].objectPath);
      }
      await use(icons);
    } finally {
      if (created.length) expect((await bucket.remove(created)).error).toBeNull();
    }
  }, { scope: "worker" }],
});

test("profile routes reject unauthenticated requests with JSON", async ({ request }) => {
  for (const method of ["GET", "PATCH"]) {
    const response = await request.fetch("/api/users/me", {
      method,
      ...(method === "PATCH" ? { data: { team_url: "https://example.com" } } : {}),
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  }
});

for (const format of ["svg", "png"] as const) {
  test(`saves and displays a cached rectangular ${format} through settings`, async ({ page, baseURL, cachedIcons }, testInfo) => {
    const env = loadWebEnv();
    const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (!["127.0.0.1", "localhost"].includes(supabaseUrl.hostname)) throw new Error("Team favicon browser tests require local Supabase");
    const db = createClient(supabaseUrl.href, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const id = crypto.randomUUID();
    const { domain, objectPath } = cachedIcons[format];
    const email = `favicon-${id}@example.test`;
    const password = crypto.randomUUID();
    const username = `fav_${id.slice(0, 8)}`;
    let releaseJavaScript = () => {};
    try {
      expect((await db.auth.admin.createUser({ id, email, password, email_confirm: true })).error).toBeNull();
      expect((await db.from("users").upsert({ id, username, timezone: "UTC", onboarding_completed: true, is_public: true })).error).toBeNull();
      expect((await db.from("team_favicon_cache").upsert({ domain, object_path: objectPath, retry_after: null })).error).toBeNull();
      const jar = new Map<string, string>();
      const member = createServerClient(supabaseUrl.href, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (cookies: { name: string; value: string }[]) => { for (const { name, value } of cookies) jar.set(name, value); },
        },
      });
      expect((await member.auth.signInWithPassword({ email, password })).error).toBeNull();
      await page.context().addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL!, sameSite: "Lax" })));
      const imageRequests: string[] = [];
      page.on("request", (request) => { if (request.resourceType() === "image") imageRequests.push(request.url()); });
      const javaScriptReady = new Promise<void>((resolve) => { releaseJavaScript = resolve; });
      await page.route("**/_next/static/**/*.js", async (route) => {
        await javaScriptReady;
        await route.continue();
      });
      await page.goto("/settings", { waitUntil: "commit" });
      await expect(page.getByLabel("Team", { exact: true })).toBeDisabled();
      releaseJavaScript();
      await page.getByLabel("Team", { exact: true }).fill(`https://${domain}`);
      const saved = page.waitForResponse((response) => response.url().endsWith("/api/users/me") && response.request().method() === "PATCH");
      await page.getByRole("button", { name: "Save Changes" }).click();
      const saveResponse = await saved;
      expect(saveResponse.request().postDataJSON().team_url).toBe(`https://${domain}`);
      expect(saveResponse.status()).toBe(200);
      expect((await saveResponse.json()).team_url).toBe(`https://${domain}`);
      await expect(page.getByText("Saved successfully.")).toBeVisible();
      const badge = page.getByRole("link", { name: `Team: ${domain}`, exact: true }).last();
      const image = badge.locator("img");
      const publicUrl = db.storage.from("team-favicons").getPublicUrl(objectPath).data.publicUrl;
      await expect(image).toHaveAttribute("src", publicUrl);
      await expect(image).toHaveCSS("object-fit", "contain");
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth / element.naturalHeight)).toBe(2);
      expect(imageRequests).toContain(publicUrl);
      expect(imageRequests.some((url) => url.includes("google.com/s2") || url.startsWith(`https://${domain}`) || (url.includes("_next/image") && url.includes("team-favicons")))).toBe(false);
      await badge.scrollIntoViewIfNeeded();
      await expect(badge).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`settings-${format}.png`), fullPage: true });

      await page.keyboard.press("ControlOrMeta+k");
      const commands = page.getByRole("combobox");
      await expect(commands).toBeVisible();
      await commands.fill("Leaderboard");
      await expect(page.getByRole("option").first()).toContainText("Leaderboard");
      await commands.press("Enter");
      await expect(page).toHaveURL(/\/leaderboard$/);
      await page.goto("/settings");
      await page.reload();
      await expect(page.getByLabel("Team", { exact: true })).toHaveValue(`https://${domain}`);
      await page.goto(`/u/${username}`);
      await expect(page.getByRole("link", { name: `Team: ${domain}`, exact: true }).last().locator("img")).toHaveAttribute("src", publicUrl);
      await page.goto("/leaderboard");
      await expect(page.getByRole("heading", { name: /leaderboard/i }).first()).toBeVisible();
    } finally {
      releaseJavaScript();
      await db.from("team_favicon_cache").delete().eq("domain", domain);
      await db.auth.admin.deleteUser(id);
    }
  });
}
