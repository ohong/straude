import { test, expect } from "./helpers/public-builder";

test("a guest sees the builder's team link on the public profile and weekly leaderboard", async ({ page, publicBuilder }) => {
  for (const path of [`/u/${publicBuilder.username}`, "/leaderboard"]) {
    await page.goto(path);
    const badge = page.getByRole("link", { name: `Team: ${publicBuilder.teamHost}`, exact: true });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("href", `https://${publicBuilder.teamHost}`);
    await expect(badge).toHaveAttribute("target", "_blank");
    await expect(badge).toHaveAttribute("rel", /(?=.*noopener)(?=.*noreferrer)/);
  }
});
