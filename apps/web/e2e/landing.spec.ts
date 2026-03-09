import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders without hydration errors", async ({ page }) => {
    const hydrationErrors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("hydrat") ||
        text.includes("did not match") ||
        text.includes("server rendered HTML")
      ) {
        hydrationErrors.push(text);
      }
    });

    await page.goto("/");
    // Wait for client-side hydration to complete
    await page.waitForTimeout(2000);

    expect(hydrationErrors).toEqual([]);
  });

  test("renders hero content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Code like");
  });

  test("does not expose internal jargon", async ({ page }) => {
    await page.goto("/");
    const body = await page.textContent("body");
    expect(body).not.toContain("Social proof");
    expect(body).not.toContain("The product");
  });

  test("CTA links to signup", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
  });

  test("follows the system dark theme on public pages", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.goto("/signup");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("applies a stored dark preference across public pages", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("straude-theme", "dark");
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.goto("/signup");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
