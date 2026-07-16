import "./env";
import { expect, type Page } from "@playwright/test";
import { createTrip } from "../../src/lib/trips";

export type Currency = "USD" | "EUR" | "CNY" | "VND" | "JPY" | "KRW";

/** Matches a trip URL: /trips/<public slug>. */
export const TRIP_URL_RE = /\/trips\/[A-Za-z0-9_-]+$/;

export function uniq(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Seed a trip directly (with optional participants); returns its public slug. */
export async function seedTrip(
  name: string,
  participants: string[] = [],
  currency: Currency = "USD",
): Promise<{ publicId: string }> {
  const publicId = await createTrip({ name, currency, participants });
  return { publicId };
}

/** Create a trip via the home dialog and land on its page. */
export async function createTripUI(page: Page, name: string, currency: Currency = "USD"): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /create a trip/i }).first().click();
  const dialog = page.locator("dialog.modal[open]");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Trip name").fill(name);
  await dialog.getByLabel("Currency").selectOption(currency);
  await dialog.getByRole("button", { name: /create trip/i }).click();
  await page.waitForURL(TRIP_URL_RE);
}

/** Add a participant on the trip page and confirm they appear in the roster. */
export async function addPerson(page: Page, name: string): Promise<void> {
  // Dismiss the "Who are you?" prompt if it auto-opened.
  await dismissWhoAreYou(page);
  await page.getByPlaceholder("Add a person").fill(name);
  await page.locator("form.ghost-form").getByRole("button", { name: /^add$/i }).click();
  await expect(page.locator(".people-list")).toContainText(name);
}

/** Close the "Who are you?" dialog if it's open (safe no-op otherwise). */
export async function dismissWhoAreYou(page: Page): Promise<void> {
  const dialog = page.locator("dialog:has-text('Who are you?')");
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /not now/i }).click();
    await expect(dialog).not.toBeVisible();
  }
}

/** Claim an identity ("you") from the roster. */
export async function pickIdentity(page: Page, name: string): Promise<void> {
  const dialog = page.locator("dialog:has-text('Who are you?')");
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /which one are you/i }).click();
  }
  await dialog.getByRole("button", { name }).click();
  await expect(dialog).not.toBeVisible();
}

/** Open the Add-expense dialog, fill + submit the manual form. `exclude` = member names to uncheck. */
export async function addExpense(
  page: Page,
  opts: { description: string; amount: string; payer: string; exclude?: string[] },
): Promise<void> {
  await dismissWhoAreYou(page);
  // Open the shared dialog (one "New expense" trigger is visible at a time).
  await page.getByRole("button", { name: /new expense/i }).click();

  const form = page.locator("dialog#add-expense-dialog form.expense-form");
  await expect(form).toBeVisible();
  await form.getByLabel("Description").fill(opts.description);
  await form.getByLabel("Amount").fill(opts.amount);
  await form.getByLabel("Paid by").selectOption({ label: opts.payer });
  for (const name of opts.exclude ?? []) {
    await form.getByRole("checkbox", { name }).uncheck();
  }
  await form.getByRole("button", { name: /add expense/i }).click();

  // Dialog closes on success.
  await expect(page.locator("dialog#add-expense-dialog")).not.toBeVisible();
}
