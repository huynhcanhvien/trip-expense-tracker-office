import { test, expect } from "@playwright/test";
import { seedVerifiedUser, login, uniq } from "./helpers";

// Scenario D: user creates a new trip and lands on its page.
test("Scenario D: create a trip → redirected to the trip page showing name + currency", async ({
  page,
}) => {
  const user = await seedVerifiedUser("dave");
  await login(page, user);

  const name = uniq("Tokyo");
  await page.goto("/dashboard/new");
  await page.getByLabel("Trip name").fill(name);
  await page.getByLabel("Currency").selectOption("JPY");
  await page.getByRole("button", { name: /create trip/i }).click();

  await page.waitForURL(/\/trips\/\d+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/Japanese Yen/)).toBeVisible();
});

test("Scenario D: end date before start date is rejected", async ({ page }) => {
  const user = await seedVerifiedUser("dave2");
  await login(page, user);

  await page.goto("/dashboard/new");
  await page.getByLabel("Trip name").fill(uniq("Bad Dates"));
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByLabel(/start date/i).fill("2026-05-10");
  await page.getByLabel(/end date/i).fill("2026-05-01");
  await page.getByRole("button", { name: /create trip/i }).click();

  await expect(page.locator("p.form-error")).toContainText(/before the start date/i);
  await expect(page).toHaveURL(/\/dashboard\/new$/);
});
