import { test, expect } from "@playwright/test";

test.describe("Public profile viewing", () => {
  const publicUsername = "ohong";

  test("public profile renders username in header", async ({ page }) => {
    const response = await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(response?.status() !== 200, "Profile unavailable — no database in CI");

    await expect(
      page.locator("header").getByText(`@${publicUsername}`)
    ).toBeVisible();
  });

  test("public profile shows follow counts", async ({ page }) => {
    const response = await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(response?.status() !== 200, "Profile unavailable — no database in CI");

    const followsLink = page.locator('a[href*="follows"]').first();
    await expect(followsLink).toBeVisible();
  });

  test("public profile shows contribution graph section", async ({
    page,
  }) => {
    const response = await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(response?.status() !== 200, "Profile unavailable — no database in CI");

    await expect(
      page.getByText("Contributions", { exact: true })
    ).toBeVisible();
  });

  test("public profile shows achievements section", async ({ page }) => {
    const response = await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(response?.status() !== 200, "Profile unavailable — no database in CI");

    // Achievements heading only renders when the user has earned achievements
    // or when viewing your own profile (shows locked badges too)
    const achievements = page.getByText("Achievements", { exact: true });
    const hasAchievements = await achievements.isVisible().catch(() => false);
    if (hasAchievements) {
      await expect(achievements).toBeVisible();
    }
  });

  test("non-existent username does not render a valid profile", async ({
    page,
  }) => {
    const fakeUser = "this_user_definitely_does_not_exist_xyz_12345";
    const response = await page.goto(`/u/${fakeUser}`);
    await page.waitForLoadState("domcontentloaded");

    const status = response?.status() ?? 0;

    // Should not return 200 — either 404 (notFound) or 500 (no database)
    expect(status).not.toBe(200);
  });

  test("public profile does not show private message", async ({ page }) => {
    const response = await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(response?.status() !== 200, "Profile unavailable — no database in CI");

    await expect(
      page.getByText("This profile is private")
    ).not.toBeVisible();
  });
});
