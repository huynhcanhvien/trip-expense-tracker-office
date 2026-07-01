import { test, expect } from "@playwright/test";
import { seedVerifiedUser, login, createTripUI, addGhost, addExpense, uniq } from "./helpers";

// Scenario A: Alice records a $60 "Dinner" split among all three
// → Bob -$20, Carol -$20, Alice +$40.
test("Scenario A: simple equal-split expense produces correct net balances", async ({ page }) => {
  const alice = await seedVerifiedUser("alice");
  await login(page, alice);

  await createTripUI(page, uniq("Trip A"), "USD");
  await addGhost(page, "Bob");
  await addGhost(page, "Carol");

  await addExpense(page, { description: "Dinner", amount: "60", payer: alice.email });

  await expect(page.locator(".balance-amount.pos")).toHaveText("+$40.00");
  const negatives = page.locator(".balance-amount.neg");
  await expect(negatives).toHaveCount(2);
  await expect(negatives.nth(0)).toHaveText("-$20.00");
  await expect(negatives.nth(1)).toHaveText("-$20.00");
});
