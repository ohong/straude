import { test, expect } from "@playwright/test";

test.describe("Public profile viewing", () => {
  const publicUsername = "ohong";

  test("public profile renders username in header", async ({ page }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("networkidle");

    // The sticky header shows @username
    await expect(
      page.locator("header").getByText(`@${publicUsername}`)
    ).toBeVisible();
  });

  test("public profile shows follow counts", async ({ page }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("networkidle");

    const followsLink = page.locator('a[href*="follows"]').first();
    await expect(followsLink).toBeVisible();
  });

  test("public profile shows contribution graph section", async ({
    page,
  }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("networkidle");

    // Use exact match to avoid matching substring in other content
    await expect(
      page.getByText("Contributions", { exact: true })
    ).toBeVisible();
  });

  test("public profile shows achievements section", async ({ page }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("Achievements", { exact: true })
    ).toBeVisible();
  });

  test("non-existent username shows not-found page", async ({ page }) => {
    await page.goto("/u/this_user_definitely_does_not_exist_xyz_12345");
    await page.waitForLoadState("domcontentloaded");

    // Next.js may return 200 with a not-found page, or 404 — check for not-found content
    const notFoundText = page.getByText("could not be found");
    const is404 = await notFoundText.isVisible().catch(() => false);

    // Or check HTTP status
    const response = await page.goto(
      "/u/this_user_definitely_does_not_exist_xyz_12345"
    );
    const status = response?.status() ?? 0;
    expect(is404 || status === 404).toBeTruthy();
  });

  test("public profile does not show private message", async ({ page }) => {
    await page.goto(`/u/${publicUsername}`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("This profile is private")
    ).not.toBeVisible();
  });
});
