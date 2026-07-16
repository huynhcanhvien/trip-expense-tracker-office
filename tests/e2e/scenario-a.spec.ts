import { test, expect } from "@playwright/test";
import { createTripUI, addPerson, addExpense, uniq } from "./helpers";

// Scenario A: Alice records a $60 "Dinner" split among all three
// → Bob -$20, Carol -$20, Alice +$40.
test("Scenario A: simple equal-split expense produces correct net balances", async ({ page }) => {
  await createTripUI(page, uniq("Trip A"), "USD");
  await addPerson(page, "Alice");
  await addPerson(page, "Bob");
  await addPerson(page, "Carol");

  await addExpense(page, { description: "Dinner", amount: "60", payer: "Alice" });

  await expect(page.locator(".balance-row .pos")).toHaveText("+$40.00");
  const negatives = page.locator(".balance-row .neg");
  await expect(negatives).toHaveCount(2);
  await expect(negatives.nth(0)).toHaveText("-$20.00");
  await expect(negatives.nth(1)).toHaveText("-$20.00");
});
