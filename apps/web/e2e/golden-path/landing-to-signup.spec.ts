import { test, expect } from "@playwright/test";

test.describe("Landing → Signup funnel", () => {
  test("landing page loads all key sections", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Hero
    await expect(page.locator("h1")).toContainText("Code like");

    // Comment label
    await expect(page.getByText("// STRAVA FOR CLAUDE CODE")).toBeVisible();

    // Features grid — target headings specifically to avoid substring matches
    await expect(
      page.getByRole("heading", { name: "Track Spend" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Compare Pace" })
    ).toBeVisible();

    // Wall of Love
    await expect(page.getByText("Claudemaxxing")).toBeVisible();

    // CTA section
    await expect(page.getByText("Ready to run?")).toBeVisible();

    // Footer
    await expect(page.getByText("PACIFIC SYSTEMS")).toBeVisible();
  });

  test("hero has correct heading and subheading", async ({ page }) => {
    await page.goto("/");

    const heading = page.locator("h1");
    await expect(heading).toContainText("Code like");
    await expect(heading).toContainText("athlete");

    await expect(
      page.getByText("One command to log your Claude Code usage")
    ).toBeVisible();
  });

  test("hero CTA links to signup", async ({ page }) => {
    await page.goto("/");

    // The hero's "Start Your Streak" link specifically
    const startCTA = page.locator('a:has-text("Start Your Streak")');
    await expect(startCTA).toBeVisible();
    await expect(startCTA).toHaveAttribute("href", "/signup");
  });

  test("navbar Get Started links to signup or login", async ({ page }) => {
    await page.goto("/");

    const getStarted = page.locator('nav a:has-text("Get Started")');
    await expect(getStarted).toBeVisible();
    const href = await getStarted.getAttribute("href");
    expect(href === "/signup" || href === "/login").toBeTruthy();
  });

  test("navigating to signup page renders form", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Create your account")).toBeVisible();

    const emailInput = page.locator("#signup-email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");

    await expect(
      page.locator('button:has-text("Send magic link")')
    ).toBeVisible();

    await expect(
      page.locator('button:has-text("Continue with GitHub")')
    ).toBeVisible();
  });

  test("signup form validates empty email", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");

    const emailInput = page.locator("#signup-email");
    const submitBtn = page.locator('button:has-text("Send magic link")');

    await submitBtn.click();

    const isValid = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(isValid).toBe(false);
  });

  test("signup page has link to login", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText("Log in");
  });

  test("login page renders from signup link", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");

    await page.locator('a[href="/login"]').click();
    await page.waitForURL(/\/login/);

    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(
      page.locator('button:has-text("Continue with GitHub")')
    ).toBeVisible();
  });
});
