import { test, expect } from "@playwright/test";
import { seedVerifiedUser, login, createTripUI, uniq } from "./helpers";

// Scenario E: the trip page exposes a Share control that yields the invite link.
test("Scenario E: trip page exposes a shareable /invite/<token> link", async ({ page }) => {
  const user = await seedVerifiedUser("erin");
  await login(page, user);
  await createTripUI(page, uniq("Trip E"), "USD");

  await expect(page.getByRole("button", { name: /share invite link/i })).toBeVisible();

  const shareUrl = page.locator("input.share-url");
  await expect(shareUrl).toHaveValue(/\/invite\/[A-Za-z0-9_-]{20,}$/);
});
