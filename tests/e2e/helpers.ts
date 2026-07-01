import "./env";
import { expect, type Page } from "@playwright/test";
import { createUser } from "../../src/lib/accounts";
import { createTrip, getInvitationToken } from "../../src/lib/trips";
import { db } from "../../src/lib/db";

export function uniq(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export interface SeededUser {
  id: number;
  email: string;
  password: string;
}

/** Create an already-verified account directly (verification is covered by unit tests). */
export async function seedVerifiedUser(prefix = "user"): Promise<SeededUser> {
  const email = `${uniq(prefix)}@e2e.local`;
  const password = "password123";
  const u = await createUser(email, password);
  await db().execute({
    sql: "UPDATE users SET email_verified_at = datetime('now') WHERE id = ?",
    args: [u.id],
  });
  return { id: u.id, email, password };
}

export async function seedTrip(
  creatorId: number,
  name: string,
  currency: "USD" | "EUR" | "CNY" | "VND" | "JPY" | "KRW" = "USD",
): Promise<{ tripId: number; token: string }> {
  const tripId = await createTrip({ name, currency }, creatorId);
  const token = (await getInvitationToken(tripId))!;
  return { tripId, token };
}

export async function login(page: Page, user: SeededUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/dashboard");
}

export async function createTripUI(
  page: Page,
  name: string,
  currency = "USD",
): Promise<void> {
  await page.goto("/dashboard/new");
  await page.getByLabel("Trip name").fill(name);
  await page.getByLabel("Currency").selectOption(currency);
  await page.getByRole("button", { name: /create trip/i }).click();
  await page.waitForURL(/\/trips\/\d+$/);
}

export async function addGhost(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder("Guest name").fill(name);
  await page.getByRole("button", { name: /add guest/i }).click();
  await expect(page.locator(".member-list")).toContainText(name);
}

/** Fill + submit the manual (top) add-expense form. `exclude` = member names to uncheck. */
export async function addExpense(
  page: Page,
  opts: { description: string; amount: string; payer: string; exclude?: string[] },
): Promise<void> {
  const form = page.locator("form.expense-form").first();
  await form.getByLabel("Description").fill(opts.description);
  await form.getByLabel("Amount").fill(opts.amount);
  await form.getByLabel("Paid by").selectOption({ label: opts.payer });
  for (const name of opts.exclude ?? []) {
    await form.getByRole("checkbox", { name }).uncheck();
  }
  await form.getByRole("button", { name: /add expense/i }).click();
}
