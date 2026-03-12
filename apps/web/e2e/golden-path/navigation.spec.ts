import { test, expect } from "@playwright/test";

test.describe("Cross-page navigation and theme", () => {
  test("landing navbar Feed link works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Navbar text is "Feed" (CSS uppercase), inside a <nav> or navigation area
    const feedLink = page.locator('a[href="/feed"]').first();
    await expect(feedLink).toBeVisible();
    await feedLink.click();
    await page.waitForURL(/\/feed/);
    expect(page.url()).toContain("/feed");
  });

  test("landing navbar Leaderboard link works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const leaderboardLink = page.locator('a[href="/leaderboard"]').first();
    await expect(leaderboardLink).toBeVisible();
    await leaderboardLink.click();
    await page.waitForURL(/\/leaderboard/);
    expect(page.url()).toContain("/leaderboard");
  });

  test("footer links to privacy and terms", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const privacyLink = page.locator('footer a[href="/privacy"]');
    await expect(privacyLink).toBeVisible();

    const termsLink = page.locator('footer a[href="/terms"]');
    await expect(termsLink).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("guest feed page has link to leaderboard", async ({ page }) => {
    await page.goto("/feed");
    await page.waitForLoadState("domcontentloaded");

    const leaderboardLink = page
      .locator('header a[href="/leaderboard"]')
      .first();
    await expect(leaderboardLink).toBeVisible();
  });

  test("dark theme persists across pages via localStorage", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("straude-theme", "dark");
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.goto("/feed");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.goto("/leaderboard");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.goto("/signup");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("light theme persists across pages via localStorage", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("straude-theme", "light");
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.goto("/leaderboard");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("no console errors on golden path pages", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore known benign errors
        if (
          text.includes("Failed to load resource") ||
          text.includes("net::ERR_") ||
          text.includes("favicon") ||
          text.includes("downloadable font") ||
          text.includes("_vercel/")
        ) {
          return;
        }
        errors.push(text);
      }
    });

    const paths = ["/", "/feed", "/leaderboard", "/signup", "/login"];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
    }

    expect(errors).toEqual([]);
  });

  test("back button works between pages", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Navigate to feed
    await page.locator('a[href="/feed"]').first().click();
    await page.waitForURL(/\/feed/);

    // Go back
    await page.goBack();
    await page.waitForURL(/\/$/);
    expect(page.url()).toMatch(/\/$/);
  });
});
