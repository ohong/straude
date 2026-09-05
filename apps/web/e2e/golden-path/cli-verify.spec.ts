import { test, expect } from "@playwright/test";

function verifyUrl(code: string) {
  return `/cli/verify?code=${encodeURIComponent(code)}&verify_secret=test-verify-secret`;
}

test.describe("CLI verify page", () => {
  test("page loads with authorization heading", async ({ page }) => {
    await page.goto(verifyUrl("TEST1234"));
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Authorize CLI");
  });

  test("displays the authorization code from URL", async ({ page }) => {
    const testCode = "ABCD1234";
    await page.goto(verifyUrl(testCode));
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(testCode)).toBeVisible();
    await expect(
      page.getByText("Your authorization code:")
    ).toBeVisible();
  });

  test("unauthenticated user sees sign-in or authorize action", async ({
    page,
  }) => {
    await page.goto(verifyUrl("TEST1234"));
    await page.waitForLoadState("networkidle");

    // Either sign-in button (for guests) or authorize button (for logged-in)
    const signInBtn = page.getByText("Sign in to authorize");
    const authorizeBtn = page.getByText("Authorize CLI").locator("visible=true");

    const hasSignIn = await signInBtn.isVisible().catch(() => false);
    const hasAuthorize = await authorizeBtn.isVisible().catch(() => false);
    expect(hasSignIn || hasAuthorize).toBeTruthy();
  });

  test("sign-in preserves the CLI request through signup and login", async ({ page }) => {
    const returnTo = verifyUrl("TEST1234");
    await page.goto(returnTo);
    await page.getByRole("button", { name: "Sign in to authorize" }).click();
    await expect(page).toHaveURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(returnTo);

    await page.getByRole("link", { name: "Sign up", exact: true }).click();
    await expect(page).toHaveURL(/\/signup\?/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(returnTo);

    await page.getByRole("link", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(returnTo);
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
