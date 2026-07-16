import { test, expect } from "@playwright/test";
import { seedTrip, uniq, TRIP_URL_RE } from "./helpers";

// Scenario F (no-auth sharing): the trip URL is the invite. Anyone who opens the
// shared link — with no account — sees the trip and can add expenses.
test("Scenario F: opening a shared trip link shows the trip and lets you edit", async ({ page }) => {
  const tripName = uniq("Trip F");
  const { publicId } = await seedTrip(tripName, ["Alice"]);

  // A brand-new visitor (fresh browser context, no login) opens the link.
  await page.goto(`/trips/${publicId}`);
  await expect(page).toHaveURL(TRIP_URL_RE);
  await expect(page.getByRole("heading", { name: new RegExp(tripName) })).toBeVisible();
  await expect(page.locator(".people-list")).toContainText("Alice");

  // The visit is remembered locally, so the trip now shows on the home page.
  await page.goto("/");
  await expect(page.locator(".trip-list")).toContainText(tripName);
});

test("Scenario F: an unknown trip link shows the not-found page", async ({ page }) => {
  const res = await page.goto("/trips/not-a-real-slug");
  expect(res?.status()).toBe(404);
});
