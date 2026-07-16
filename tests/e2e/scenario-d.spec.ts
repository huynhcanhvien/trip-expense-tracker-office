import { test, expect } from "@playwright/test";
import { uniq, TRIP_URL_RE } from "./helpers";

// Scenario D: user creates a new trip via the home dialog and lands on its page.
test("Scenario D: create a trip via the New trip dialog → trip page shows name + currency", async ({
  page,
}) => {
  await page.goto("/");

  const name = uniq("Tokyo");
  await page.getByRole("button", { name: /create a trip/i }).first().click();
  const dialog = page.locator("dialog.modal[open]");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Trip name").fill(name);
  await dialog.getByLabel("Currency").selectOption("JPY");
  await dialog.getByRole("button", { name: /create trip/i }).click();

  await page.waitForURL(TRIP_URL_RE);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/JPY/)).toBeVisible();
});

test("Scenario D: a missing trip name is rejected (dialog stays open)", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /create a trip/i }).first().click();
  const dialog = page.locator("dialog.modal[open]");

  // Submit with an empty name → HTML required validation keeps us in the dialog.
  await dialog.getByRole("button", { name: /create trip/i }).click();
  await expect(dialog).toBeVisible(); // no navigation
});
