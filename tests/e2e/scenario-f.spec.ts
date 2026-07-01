import { test, expect } from "@playwright/test";
import { seedVerifiedUser, seedTrip, login, uniq } from "./helpers";

// Scenario F: invitation preview + accept for a logged-in, not-yet-member user,
// plus the already-member and invalid-token branches.
test("Scenario F: logged-in non-member previews then accepts an invitation", async ({ page }) => {
  const alice = await seedVerifiedUser("alice-f");
  const tripName = uniq("Trip F");
  const { tripId, token } = await seedTrip(alice.id, tripName);

  const bob = await seedVerifiedUser("bob-f");
  await login(page, bob);

  // Preview (name + member list + Accept), no expense details.
  await page.goto(`/invite/${token}`);
  await expect(page.getByRole("heading", { name: new RegExp(tripName) })).toBeVisible();
  await expect(page.getByText(alice.email)).toBeVisible();
  const accept = page.getByRole("button", { name: /accept invitation/i });
  await expect(accept).toBeVisible();

  // Accept → added and redirected to the trip.
  await accept.click();
  await page.waitForURL(new RegExp(`/trips/${tripId}$`));
  await expect(page.locator(".member-list")).toContainText(bob.email);

  // Re-clicking the link as an existing member → straight to the trip (no double-add).
  await page.goto(`/invite/${token}`);
  await page.waitForURL(new RegExp(`/trips/${tripId}$`));
  await expect(page.locator(".member-list").getByText(bob.email)).toHaveCount(1);
});

test("Scenario F: an invalid invite token shows a friendly error", async ({ page }) => {
  const user = await seedVerifiedUser("frank");
  await login(page, user);

  await page.goto("/invite/not-a-real-token");
  await expect(page.getByText(/invalid invitation/i)).toBeVisible();
});
