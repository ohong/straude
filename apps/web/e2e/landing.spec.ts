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
    await expect(page.locator("h1")).toContainText("Every session counts");
  });

  test("does not expose internal jargon", async ({ page }) => {
    await page.goto("/");
    const body = await page.textContent("body");
    expect(body).not.toContain("Social proof");
    expect(body).not.toContain("The product");
  });

  test("CTA says Start Your Streak", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator('a[href="/signup"]').first()
    ).toContainText("Start Your Streak");
  });
});
