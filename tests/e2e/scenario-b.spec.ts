import { test, expect } from "@playwright/test";
import { seedVerifiedUser, seedTrip, login, uniq } from "./helpers";

// Scenario B: after logging in, the user lands on the dashboard listing their trips.
test("Scenario B: login lands on the dashboard listing the user's trips", async ({ page }) => {
  const user = await seedVerifiedUser("bob");
  const tripName = uniq("My Trip");
  await seedTrip(user.id, tripName);

  await login(page, user);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your trips" })).toBeVisible();
  await expect(page.locator(".trip-list")).toContainText(tripName);
});

// Empty-state half of Scenario B: a fresh user sees "Create new trip".
test("Scenario B: a user with no trips sees the empty state", async ({ page }) => {
  const user = await seedVerifiedUser("empty");
  await login(page, user);

  await expect(page.getByText(/don't have any trips/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /create new trip/i })).toBeVisible();
});
