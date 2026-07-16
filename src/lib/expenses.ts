// Expense creation + loading — no-auth model: anyone with the trip link may
// add/edit/delete expenses while the trip is open (archived = read-only).
import Big from "big.js";
import type { Client } from "@libsql/client";
import { db } from "./db";
import { decimalPlaces, formatAmount, type CurrencyCode } from "./currency";
import { getTripById } from "./trips";

/** A user-facing error (safe to show in the UI). */
export class ExpenseError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SplitMode = "even" | "custom";

/** One person's exact share in a custom split. */
export interface ExpenseShareInput {
  memberId: number; // trip_members.id
  amount: string; // decimal string from the form
}

interface ExpenseFields {
  description: string;
  amount: string;
  expenseDate: string;
  payerMemberId: number;
  /** How to divide the total. Defaults to an even split. */
  splitMode?: SplitMode;
  /** Even split: the members the total is divided equally among. */
  includedMemberIds: number[];
  /** Custom split: each member's exact amount (must sum to the total). */
  customShares?: ExpenseShareInput[];
}

export interface CreateExpenseInput extends ExpenseFields {
  tripId: number;
  photoPath?: string | null;
}

/** Raw expense + its shares, for balance computation and display. */
export interface ExpenseWithShares {
  id: number;
  payerMemberId: number;
  amount: string;
  description: string;
  expenseDate: string;
  photoPath: string | null;
  /** All members in the split (payer aside). */
  includedMemberIds: number[];
  /** memberId → exact amount for a custom split; null for an even split. */
  customShares: Map<number, string> | null;
}

async function tripMemberIds(tripId: number, client: Client): Promise<Set<number>> {
  const res = await client.execute({
    sql: "SELECT id FROM trip_members WHERE trip_id = ?",
    args: [tripId],
  });
  return new Set(res.rows.map((r) => Number(r.id)));
}

/** A single expense_shares row to persist: null amount = even (derived) split. */
interface PreparedShare {
  memberId: number;
  amount: string | null;
}

/** Validate + normalize an expense's fields against its trip. Throws ExpenseError. */
async function prepareExpense(
  tripId: number,
  currency: CurrencyCode,
  input: ExpenseFields,
  client: Client,
): Promise<{ amount: string; description: string; shares: PreparedShare[]; payerMemberId: number }> {
  const dp = decimalPlaces(currency);
  const description = input.description.trim();
  if (!description) throw new ExpenseError("Description is required");
  if (description.length > 200) throw new ExpenseError("Description is too long");

  if (!DATE_RE.test(input.expenseDate)) throw new ExpenseError("Enter a valid date");

  let amount: Big;
  try {
    amount = new Big(input.amount);
  } catch {
    throw new ExpenseError("Enter a valid amount");
  }
  amount = amount.round(dp, Big.roundHalfUp);
  if (amount.lte(0)) throw new ExpenseError("Amount must be greater than 0");

  const memberIds = await tripMemberIds(tripId, client);
  if (!memberIds.has(input.payerMemberId)) {
    throw new ExpenseError("Payer must be a trip member");
  }

  let shares: PreparedShare[];
  if (input.splitMode === "custom") {
    // Each person's exact amount; only positive shares count (0 = not in it).
    const positive: { memberId: number; amount: Big }[] = [];
    for (const s of input.customShares ?? []) {
      if (!memberIds.has(s.memberId)) {
        throw new ExpenseError("Everyone in the split must be a trip member");
      }
      let a: Big;
      try {
        a = new Big(s.amount || "0");
      } catch {
        throw new ExpenseError("Enter a valid amount for each person");
      }
      a = a.round(dp, Big.roundHalfUp);
      if (a.lt(0)) throw new ExpenseError("A share can't be negative");
      if (a.gt(0)) positive.push({ memberId: s.memberId, amount: a });
    }
    if (positive.length === 0) throw new ExpenseError("Enter an amount for at least one person");

    const sum = positive.reduce((t, p) => t.plus(p.amount), new Big(0));
    if (!sum.eq(amount)) {
      throw new ExpenseError(
        `The shares add up to ${formatAmount(sum, currency)}, but the total is ` +
          `${formatAmount(amount, currency)}. Adjust them to match.`,
      );
    }
    shares = positive.map((p) => ({ memberId: p.memberId, amount: p.amount.toString() }));
  } else {
    const included = [...new Set(input.includedMemberIds)];
    if (included.length === 0) throw new ExpenseError("Choose at least one person to split with");
    for (const id of included) {
      if (!memberIds.has(id)) throw new ExpenseError("Everyone in the split must be a trip member");
    }
    shares = included.map((id) => ({ memberId: id, amount: null }));
  }

  return { amount: amount.toString(), description, shares, payerMemberId: input.payerMemberId };
}

interface ExpenseContext {
  tripId: number;
  currency: CurrencyCode;
  status: "open" | "closed";
}

/** Load a single expense's trip context, or null if missing. */
async function getExpenseContext(
  expenseId: number,
  client: Client,
): Promise<ExpenseContext | null> {
  const res = await client.execute({
    sql: `SELECT e.trip_id, t.currency, t.status
            FROM expenses e
            JOIN trips t ON t.id = e.trip_id
           WHERE e.id = ?`,
    args: [expenseId],
  });
  const r = res.rows[0];
  if (!r) return null;
  return {
    tripId: Number(r.trip_id),
    currency: r.currency as CurrencyCode,
    status: r.status as "open" | "closed",
  };
}

/**
 * Record an expense. The split is either even (equal share of the total among
 * the included set) or custom (each member's exact amount, summing to the
 * total). Payer is independent of the split (may be excluded). Inserts the
 * Expense + one ExpenseShare per included member in a single transaction.
 * Returns the id.
 */
export async function createExpense(
  input: CreateExpenseInput,
  client: Client = db(),
): Promise<number> {
  const trip = await getTripById(input.tripId, client);
  if (!trip) throw new ExpenseError("Trip not found");
  if (trip.status === "closed") throw new ExpenseError("This trip is archived");

  const p = await prepareExpense(input.tripId, trip.currency, input, client);

  const tx = await client.transaction("write");
  try {
    const exp = await tx.execute({
      sql: `INSERT INTO expenses
              (trip_id, payer_member_id, amount, description, expense_date, photo_path)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        input.tripId,
        p.payerMemberId,
        p.amount,
        p.description,
        input.expenseDate,
        input.photoPath ?? null,
      ],
    });
    const expenseId = Number(exp.rows[0].id);
    for (const s of p.shares) {
      await tx.execute({
        sql: "INSERT INTO expense_shares (expense_id, member_id, share_amount) VALUES (?, ?, ?)",
        args: [expenseId, s.memberId, s.amount],
      });
    }
    await tx.commit();
    return expenseId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** Edit an existing expense. Allowed for anyone while the trip is open. */
export async function updateExpense(
  expenseId: number,
  input: ExpenseFields,
  client: Client = db(),
): Promise<number> {
  const ctx = await getExpenseContext(expenseId, client);
  if (!ctx) throw new ExpenseError("Expense not found");
  if (ctx.status === "closed") throw new ExpenseError("This trip is archived");

  const p = await prepareExpense(ctx.tripId, ctx.currency, input, client);

  const tx = await client.transaction("write");
  try {
    await tx.execute({
      sql: `UPDATE expenses
               SET payer_member_id = ?, amount = ?, description = ?, expense_date = ?
             WHERE id = ?`,
      args: [p.payerMemberId, p.amount, p.description, input.expenseDate, expenseId],
    });
    await tx.execute({ sql: "DELETE FROM expense_shares WHERE expense_id = ?", args: [expenseId] });
    for (const s of p.shares) {
      await tx.execute({
        sql: "INSERT INTO expense_shares (expense_id, member_id, share_amount) VALUES (?, ?, ?)",
        args: [expenseId, s.memberId, s.amount],
      });
    }
    await tx.commit();
    return ctx.tripId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** Delete an expense. Allowed for anyone while the trip is open. Returns the trip id. */
export async function deleteExpense(expenseId: number, client: Client = db()): Promise<number> {
  const ctx = await getExpenseContext(expenseId, client);
  if (!ctx) throw new ExpenseError("Expense not found");
  if (ctx.status === "closed") throw new ExpenseError("This trip is archived");

  const tx = await client.transaction("write");
  try {
    // Delete shares explicitly (FK cascade requires foreign_keys=ON, not guaranteed).
    await tx.execute({ sql: "DELETE FROM expense_shares WHERE expense_id = ?", args: [expenseId] });
    await tx.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [expenseId] });
    await tx.commit();
    return ctx.tripId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * All expenses for a trip with their included member ids, newest first.
 * Two queries (expenses + all shares), stitched in memory — never N+1 (plan §5).
 */
export async function getTripExpenses(
  tripId: number,
  client: Client = db(),
): Promise<ExpenseWithShares[]> {
  const [expenses, shares] = await Promise.all([
    client.execute({
      sql: `SELECT id, payer_member_id, amount, description, expense_date, photo_path
              FROM expenses WHERE trip_id = ?
             ORDER BY expense_date DESC, id DESC`,
      args: [tripId],
    }),
    client.execute({
      sql: `SELECT es.expense_id, es.member_id, es.share_amount
              FROM expense_shares es
              JOIN expenses e ON e.id = es.expense_id
             WHERE e.trip_id = ?`,
      args: [tripId],
    }),
  ]);

  // Per expense: the member ids in the split, plus any explicit custom amounts.
  const sharesByExpense = new Map<number, { memberId: number; amount: string | null }[]>();
  for (const row of shares.rows) {
    const eid = Number(row.expense_id);
    const list = sharesByExpense.get(eid) ?? [];
    list.push({
      memberId: Number(row.member_id),
      amount: row.share_amount == null ? null : String(row.share_amount),
    });
    sharesByExpense.set(eid, list);
  }

  return expenses.rows.map((r) => {
    const rows = sharesByExpense.get(Number(r.id)) ?? [];
    // A custom split has explicit amounts; an even split has all-null amounts.
    const custom = rows.some((s) => s.amount != null);
    return {
      id: Number(r.id),
      payerMemberId: Number(r.payer_member_id),
      amount: String(r.amount),
      description: String(r.description),
      expenseDate: String(r.expense_date),
      photoPath: (r.photo_path as string | null) ?? null,
      includedMemberIds: rows.map((s) => s.memberId),
      customShares: custom
        ? new Map(rows.filter((s) => s.amount != null).map((s) => [s.memberId, s.amount as string]))
        : null,
    };
  });
}
