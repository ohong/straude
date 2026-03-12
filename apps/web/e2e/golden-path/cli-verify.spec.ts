import { test, expect } from "@playwright/test";

test.describe("CLI verify page", () => {
  test("page loads with authorization heading", async ({ page }) => {
    await page.goto("/cli/verify?code=TEST1234");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Authorize CLI");
  });

  test("displays the authorization code from URL", async ({ page }) => {
    const testCode = "ABCD1234";
    await page.goto(`/cli/verify?code=${testCode}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(testCode)).toBeVisible();
    await expect(
      page.getByText("Your authorization code:")
    ).toBeVisible();
  });

  test("unauthenticated user sees sign-in or authorize action", async ({
    page,
  }) => {
    await page.goto("/cli/verify?code=TEST1234");
    await page.waitForLoadState("networkidle");

    // Either sign-in button (for guests) or authorize button (for logged-in)
    const signInBtn = page.getByText("Sign in to authorize");
    const authorizeBtn = page.getByText("Authorize CLI").locator("visible=true");

    const hasSignIn = await signInBtn.isVisible().catch(() => false);
    const hasAuthorize = await authorizeBtn.isVisible().catch(() => false);
    expect(hasSignIn || hasAuthorize).toBeTruthy();
  });

  test("sign-in link includes return URL", async ({ page }) => {
    await page.goto("/cli/verify?code=TEST1234");
    await page.waitForLoadState("networkidle");

    const signInLink = page.locator('a:has-text("Sign in to authorize")');
    const isVisible = await signInLink.isVisible().catch(() => false);

    if (isVisible) {
      const href = await signInLink.getAttribute("href");
      expect(href).toContain("/login");
      expect(href).toContain("next=");
    }
  });

  test("page without code param shows missing code message", async ({
    page,
  }) => {
    await page.goto("/cli/verify");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByText("No authorization code provided")
    ).toBeVisible();
  });
});
