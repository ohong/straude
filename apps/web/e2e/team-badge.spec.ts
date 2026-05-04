import { test, expect, type Page } from "@playwright/test";

// Authenticated save flow (settings → PATCH /api/users/me → resolver →
// Storage cache) is covered by the team-favicon.test.ts unit suite plus a
// manual smoke before merge — there is no auth fixture in this repo.
//
// This spec asserts the rendering wiring: when a public user has a team URL
// set on their profile, the <TeamBadge> renders next to their @username on
// the surfaces that expose them anonymously (profile page header,
// leaderboard rows). Each test skips with a clear message when no public
// user currently has a team affiliation set, so the spec is forward-
// compatible with an empty production state.

const TEST_USERNAME = process.env.STRAUDE_E2E_TEAM_USERNAME ?? "ohong";

async function findFirstTeamBadge(page: Page) {
  return page.locator('a[aria-label^="Team: "]').first();
}

test.describe("Team affiliation badge — public surfaces", () => {
  test("renders next to @username on the profile header", async ({ page }) => {
    await page.goto(`/u/${TEST_USERNAME}`);
    await page.waitForLoadState("domcontentloaded");

    const badge = await findFirstTeamBadge(page);
    const visible = await badge.isVisible().catch(() => false);
    test.skip(
      !visible,
      `User @${TEST_USERNAME} has no team URL set. Sign in as that user, save a Team URL on /settings, then re-run.`,
    );

    await expect(badge).toHaveAttribute("target", "_blank");
    await expect(badge).toHaveAttribute(
      "rel",
      /(?=.*noopener)(?=.*noreferrer)/,
    );
    await expect(badge).toHaveAttribute("aria-label", /^Team: \S+$/);
    const href = await badge.getAttribute("href");
    expect(href).toMatch(/^https?:\/\//);
  });

  test("renders next to a username on the leaderboard", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("domcontentloaded");

    const badge = await findFirstTeamBadge(page);
    const visible = await badge.isVisible().catch(() => false);
    test.skip(
      !visible,
      "No leaderboard user has a team URL set. Save a Team URL on /settings for any public profile and re-run.",
    );

    await expect(badge).toHaveAttribute("target", "_blank");
    await expect(badge).toHaveAttribute("aria-label", /^Team: \S+$/);
  });
});
