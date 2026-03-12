import { test, expect } from "@playwright/test";

test.describe("Public leaderboard", () => {
  test("page loads with period tabs", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator('button:has-text("Day")')).toBeVisible();
    await expect(page.locator('button:has-text("Week")')).toBeVisible();
    await expect(page.locator('button:has-text("Month")')).toBeVisible();
    await expect(page.locator('button:has-text("All Time")')).toBeVisible();
  });

  test("switching period updates URL", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("domcontentloaded");

    await page.locator('button:has-text("Month")').click();
    await expect(page).toHaveURL(/period=month/);

    await page.locator('button:has-text("All Time")').click();
    await expect(page).toHaveURL(/period=all_time/);

    await page.locator('button:has-text("Week")').click();
    await expect(page).toHaveURL(/period=week/);
  });

  test("region filter buttons are visible and update URL", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator('button:has-text("Global")')).toBeVisible();
    await expect(
      page.locator('button:has-text("N. America")')
    ).toBeVisible();
    await expect(page.locator('button:has-text("Europe")')).toBeVisible();
    await expect(page.locator('button:has-text("Asia")')).toBeVisible();

    // Click a region and check URL
    await page.locator('button:has-text("Europe")').click();
    await expect(page).toHaveURL(/region=europe/);

    // Click Global to clear region param
    await page.locator('button:has-text("Global")').click();
    // Wait for navigation to complete
    await page.waitForLoadState("domcontentloaded");
    // Global should not have region= in URL (or only period=)
    await expect(page).not.toHaveURL(/region=/);
  });

  test("leaderboard shows table or empty state", async ({ page }) => {
    await page.goto("/leaderboard?period=all_time");
    await page.waitForLoadState("domcontentloaded");

    const table = page.locator("table");
    const emptyState = page.getByText("No entries yet");

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();

    if (hasTable) {
      await expect(
        page.locator("th").filter({ hasText: "Rank" })
      ).toBeVisible();
      await expect(
        page.locator("th").filter({ hasText: "User" })
      ).toBeVisible();
      await expect(
        page.locator("th").filter({ hasText: "Cost" })
      ).toBeVisible();
    }
  });

  test("clicking a username navigates to profile", async ({ page }) => {
    await page.goto("/leaderboard?period=all_time");
    await page.waitForLoadState("networkidle");

    const userLink = page.locator('a[href^="/u/"]').first();
    const linkVisible = await userLink.isVisible().catch(() => false);

    if (linkVisible) {
      await userLink.click();
      await page.waitForURL(/\/u\//);
      expect(page.url()).toContain("/u/");
    }
  });

  test("guest header has Feed, Leaderboard, and Get Started links", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator('header a[href="/feed"]')).toBeVisible();
    await expect(
      page.locator('header a[href="/leaderboard"]')
    ).toBeVisible();
    await expect(
      page.locator('header a:has-text("Get Started")')
    ).toBeVisible();
  });
});
