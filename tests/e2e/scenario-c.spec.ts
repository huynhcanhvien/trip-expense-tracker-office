import { test, expect } from "@playwright/test";
import { seedVerifiedUser, login, createTripUI, uniq } from "./helpers";

// Scenario C: capture an expense from a receipt photo. The OCR endpoint is mocked
// (as the plan directs for CI) to exercise both the unreadable re-upload prompt
// and the pre-filled review flow — where the payer is NOT assumed.
test("Scenario C: receipt photo → re-upload prompt when unreadable, then review + save", async ({
  page,
}) => {
  const alice = await seedVerifiedUser("carol");
  await login(page, alice);
  await createTripUI(page, uniq("Trip C"), "USD");

  // Mock the OCR endpoint; toggled by `readable`.
  let readable = false;
  await page.route("**/api/expenses/from-photo", async (route) => {
    const body = readable
      ? { readable: true, receiptPath: "/uploads/mock.png", amount: "42.50", description: "Sushi", expenseDate: "2026-07-01" }
      : { readable: false };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.getByText(/add from a receipt photo/i).click();

  // Unreadable → re-upload prompt (scenario C).
  await page.getByLabel(/scan a receipt photo/i).setInputFiles({
    name: "blurry.png",
    mimeType: "image/png",
    buffer: Buffer.from("blurry"),
  });
  await expect(page.getByText(/couldn't read that image/i)).toBeVisible();

  // Now a readable receipt → review form pre-filled, payer NOT assumed.
  readable = true;
  await page.getByLabel(/scan a receipt photo/i).setInputFiles({
    name: "clear.png",
    mimeType: "image/png",
    buffer: Buffer.from("clear"),
  });

  const review = page.locator(".photo-details form.expense-form");
  await expect(review.getByLabel("Amount")).toHaveValue("42.50");
  await expect(review.getByLabel("Description")).toHaveValue("Sushi");
  await expect(review.getByLabel("Paid by")).toHaveValue(""); // payer not pre-selected (R4)

  await review.getByLabel("Paid by").selectOption({ label: alice.email });
  await review.getByRole("button", { name: /add expense/i }).click();

  await expect(page.locator(".expense-list")).toContainText("Sushi");
  await expect(page.locator(".expense-list")).toContainText("$42.50");
});
