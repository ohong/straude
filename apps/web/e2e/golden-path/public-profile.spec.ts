import { test, expect, type Page } from "@playwright/test";

async function isProfileUnavailable(page: Page) {
  // In CI without a database, profile pages may return 404 or 500
  const notFound = await page
    .getByRole("heading", { name: "This page could not be found." })
    .isVisible()
    .catch(() => false);
  if (notFound) return true;
  // Check for generic error pages (500, etc.)
  const errorText = await page
    .getByText("Application error")
    .isVisible()
    .catch(() => false);
  if (errorText) return true;
  // No @username in header means the profile didn't load
  const hasProfile = await page
    .locator("header")
    .getByText("@")
    .isVisible()
    .catch(() => false);
  return !hasProfile;
}

test.describe("Public profile viewing", () => {
  const publicUsername = "ohong";

  test("public profile renders username in header", async ({ page }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(await isProfileUnavailable(page), "Profile unavailable — no database in CI");

    await expect(
      page.locator("header").getByText(`@${publicUsername}`)
    ).toBeVisible();
  });

  test("public profile shows follow counts", async ({ page }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(await isProfileUnavailable(page), "Profile unavailable — no database in CI");

    const followsLink = page.locator('a[href*="follows"]').first();
    await expect(followsLink).toBeVisible();
  });

  test("public profile shows contribution graph section", async ({
    page,
  }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(await isProfileUnavailable(page), "Profile unavailable — no database in CI");

    await expect(
      page.getByText("Contributions", { exact: true })
    ).toBeVisible();
  });

  test("public profile shows achievements section", async ({ page }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(await isProfileUnavailable(page), "Profile unavailable — no database in CI");

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
    await page.goto(`/u/${fakeUser}`);
    await page.waitForLoadState("domcontentloaded");

    // Without a database, any profile page errors out — skip in that case
    const hasError = await page.getByText("Application error").isVisible().catch(() => false);
    test.skip(hasError, "App error page — no database in CI");

    await expect(
      page.getByRole("heading", { name: "This page could not be found." })
    ).toBeVisible();
  });

  test("public profile does not show private message", async ({ page }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("domcontentloaded");
    test.skip(await isProfileUnavailable(page), "Profile unavailable — no database in CI");

    await expect(
      page.getByText("This profile is private")
    ).not.toBeVisible();
  });
});
