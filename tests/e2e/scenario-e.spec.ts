import { test, expect } from "@playwright/test";
import { createTripUI, dismissWhoAreYou, uniq } from "./helpers";

// Scenario E: the trip page exposes a Share control with the shareable trip link.
// Anyone with the link can open and edit the trip — no account needed.
test("Scenario E: trip page exposes a shareable /trips/<slug> link", async ({ page }) => {
  await createTripUI(page, uniq("Trip E"), "USD");
  await dismissWhoAreYou(page);

  await expect(page.getByRole("button", { name: /copy trip link/i })).toBeVisible();

  const shareUrl = page.locator("input.share-url");
  await expect(shareUrl).toHaveValue(/\/trips\/[A-Za-z0-9_-]{10,}$/);
});
