import { test, expect } from "@playwright/test";
import { createTripUI, uniq, TRIP_URL_RE } from "./helpers";

// Scenario B: the home page lists the trips this browser has visited
// (remembered in localStorage — there are no accounts).
test("Scenario B: a visited trip appears on the home page", async ({ page }) => {
  const tripName = uniq("My Trip");
  await createTripUI(page, tripName); // visiting the trip records it locally
  await expect(page).toHaveURL(TRIP_URL_RE);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /your trips/i })).toBeVisible();
  await expect(page.locator(".trip-list")).toContainText(tripName);
});

// Empty-state half of Scenario B: a fresh browser (no recent trips) sees the prompt.
test("Scenario B: a browser with no trips sees the empty state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/no trips yet/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /create a trip/i }).first()).toBeVisible();
});
