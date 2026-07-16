import { test, expect } from "@playwright/test";
import { createTripUI, addPerson, addExpense, uniq } from "./helpers";

// Scenario G: Alice pays $20 for Bob & Carol only (Alice excluded)
// → Alice +$20, Bob -$10, Carol -$10.
test("Scenario G: payer excluded from the split still gets credited", async ({ page }) => {
  await createTripUI(page, uniq("Trip G"), "USD");
  await addPerson(page, "Alice");
  await addPerson(page, "Bob");
  await addPerson(page, "Carol");

  // Uncheck Alice (the payer) from the split.
  await addExpense(page, {
    description: "Coffee for Bob & Carol",
    amount: "20",
    payer: "Alice",
    exclude: ["Alice"],
  });

  await expect(page.locator(".balance-row .pos")).toHaveText("+$20.00");
  const negatives = page.locator(".balance-row .neg");
  await expect(negatives).toHaveCount(2);
  await expect(negatives.nth(0)).toHaveText("-$10.00");
  await expect(negatives.nth(1)).toHaveText("-$10.00");
});
