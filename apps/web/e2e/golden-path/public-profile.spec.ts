import { test, expect } from "../helpers/public-builder";

test("guests see a public builder's identity, follows, contributions and earned badge", async ({ page, publicBuilder }) => {
  const { username } = publicBuilder;
  await page.goto(`/u/${username}`);
  await expect(page.getByText(`@${username}`, { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/u/${username}/follows?tab=followers"]`)).toBeVisible();
  await expect(page.getByText("Contributions", { exact: true })).toBeVisible();
  await expect(page.getByText("Achievements", { exact: true })).toBeVisible();
  await expect(page.getByTitle("First Sync", { exact: true })).toBeVisible();
  await expect(page.getByText("This profile is private", { exact: true })).toHaveCount(0);
});

test("a missing profile renders the recovery page", async ({ page }) => {
  await page.goto("/u/this_user_definitely_does_not_exist_xyz_12345");
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
});
