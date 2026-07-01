import { test, expect } from "@playwright/test";
import { seedVerifiedUser, login, uniq } from "./helpers";

// Scenario D: user creates a new trip via the dashboard dialog and lands on its page.
test("Scenario D: create a trip via the New trip dialog → trip page shows name + currency", async ({
  page,
}) => {
  const user = await seedVerifiedUser("dave");
  await login(page, user);

  const name = uniq("Tokyo");
  await page.getByRole("button", { name: "New trip", exact: true }).click();
  const dialog = page.locator("dialog.modal[open]");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Trip name").fill(name);
  await dialog.getByLabel("Currency").selectOption("JPY");
  await dialog.getByRole("button", { name: /create trip/i }).click();

  await page.waitForURL(/\/trips\/\d+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/Japanese Yen/)).toBeVisible();
});

test("Scenario D: end date before start date is rejected (dialog stays open)", async ({ page }) => {
  const user = await seedVerifiedUser("dave2");
  await login(page, user);

  await page.getByRole("button", { name: "New trip", exact: true }).click();
  const dialog = page.locator("dialog.modal[open]");

  await dialog.getByLabel("Trip name").fill(uniq("Bad Dates"));
  await dialog.getByLabel("Currency").selectOption("USD");
  await dialog.getByLabel(/start date/i).fill("2026-05-10");
  await dialog.getByLabel(/end date/i).fill("2026-05-01");
  await dialog.getByRole("button", { name: /create trip/i }).click();

  await expect(dialog.locator("p.form-error")).toContainText(/before the start date/i);
  await expect(page).toHaveURL(/\/dashboard$/);
});
