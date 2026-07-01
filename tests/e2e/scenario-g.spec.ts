import { test, expect } from "@playwright/test";
import { seedVerifiedUser, login, createTripUI, addGhost, addExpense, uniq } from "./helpers";

// Scenario G: Alice pays $20 for Bob & Carol only (Alice excluded)
// → Alice +$20, Bob -$10, Carol -$10.
test("Scenario G: payer excluded from the split still gets credited", async ({ page }) => {
  const alice = await seedVerifiedUser("grace");
  await login(page, alice);

  await createTripUI(page, uniq("Trip G"), "USD");
  await addGhost(page, "Bob");
  await addGhost(page, "Carol");

  // Uncheck Alice (the payer) from the split.
  await addExpense(page, {
    description: "Coffee for Bob & Carol",
    amount: "20",
    payer: alice.email,
    exclude: [alice.email],
  });

  await expect(page.locator(".balance-amount.pos")).toHaveText("+$20.00");
  const negatives = page.locator(".balance-amount.neg");
  await expect(negatives).toHaveCount(2);
  await expect(negatives.nth(0)).toHaveText("-$10.00");
  await expect(negatives.nth(1)).toHaveText("-$10.00");
});
