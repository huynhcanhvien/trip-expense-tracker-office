// Expense creation + loading — spec R2, scenarios A & G.
import Big from "big.js";
import type { Client } from "@libsql/client";
import { db } from "./db";
import { decimalPlaces, type CurrencyCode } from "./currency";
import { getTripForUser } from "./trips";

/** A user-facing error (safe to show in the UI). */
export class ExpenseError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateExpenseInput {
  tripId: number;
  description: string;
  amount: string; // decimal string from the form
  expenseDate: string; // 'YYYY-MM-DD'
  payerMemberId: number; // trip_members.id
  includedMemberIds: number[]; // trip_members.id[]
  photoPath?: string | null;
}

/** Raw expense + its included member ids, for balance computation and display. */
export interface ExpenseWithShares {
  id: number;
  payerMemberId: number;
  amount: string;
  description: string;
  expenseDate: string;
  photoPath: string | null;
  createdByUserId: number;
  includedMemberIds: number[];
}

async function tripMemberIds(tripId: number, client: Client): Promise<Set<number>> {
  const res = await client.execute({
    sql: "SELECT id FROM trip_members WHERE trip_id = ?",
    args: [tripId],
  });
  return new Set(res.rows.map((r) => Number(r.id)));
}

interface ExpenseFields {
  description: string;
  amount: string;
  expenseDate: string;
  payerMemberId: number;
  includedMemberIds: number[];
}

/** Validate + normalize an expense's fields against its trip. Throws ExpenseError. */
async function prepareExpense(
  tripId: number,
  currency: CurrencyCode,
  input: ExpenseFields,
  client: Client,
): Promise<{ amount: string; description: string; included: number[]; payerMemberId: number }> {
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
  amount = amount.round(decimalPlaces(currency), Big.roundHalfUp);
  if (amount.lte(0)) throw new ExpenseError("Amount must be greater than 0");

  const included = [...new Set(input.includedMemberIds)];
  if (included.length === 0) throw new ExpenseError("Choose at least one person to split with");

  const memberIds = await tripMemberIds(tripId, client);
  if (!memberIds.has(input.payerMemberId)) {
    throw new ExpenseError("Payer must be a trip member");
  }
  for (const id of included) {
    if (!memberIds.has(id)) throw new ExpenseError("Everyone in the split must be a trip member");
  }

  return { amount: amount.toString(), description, included, payerMemberId: input.payerMemberId };
}

interface ExpenseContext {
  tripId: number;
  currency: CurrencyCode;
  status: "open" | "closed";
  creatorUserId: number;
  payerUserId: number | null;
}

/** Load a single expense's trip + payer context for authz, or null if missing. */
async function getExpenseContext(
  expenseId: number,
  client: Client,
): Promise<ExpenseContext | null> {
  const res = await client.execute({
    sql: `SELECT e.trip_id, t.currency, t.status, t.creator_user_id, pm.user_id AS payer_user_id
            FROM expenses e
            JOIN trips t ON t.id = e.trip_id
            JOIN trip_members pm ON pm.id = e.payer_member_id
           WHERE e.id = ?`,
    args: [expenseId],
  });
  const r = res.rows[0];
  if (!r) return null;
  return {
    tripId: Number(r.trip_id),
    currency: r.currency as CurrencyCode,
    status: r.status as "open" | "closed",
    creatorUserId: Number(r.creator_user_id),
    payerUserId: r.payer_user_id == null ? null : Number(r.payer_user_id),
  };
}

/** R5: only the original payer (if registered) or the trip creator may edit/delete. */
function canModify(ctx: ExpenseContext, userId: number): boolean {
  return ctx.creatorUserId === userId || ctx.payerUserId === userId;
}

/**
 * Record an expense (R2): equal split among the included set, payer independent
 * of that set (may be excluded — scenario G). Inserts the Expense + one
 * ExpenseShare per included member in a single transaction. Returns the id.
 */
export async function createExpense(
  input: CreateExpenseInput,
  actingUserId: number,
  client: Client = db(),
): Promise<number> {
  const trip = await getTripForUser(input.tripId, actingUserId, client);
  if (!trip) throw new ExpenseError("You're not a member of this trip");
  if (trip.status === "closed") throw new ExpenseError("This trip is archived");

  const p = await prepareExpense(input.tripId, trip.currency, input, client);

  const tx = await client.transaction("write");
  try {
    const exp = await tx.execute({
      sql: `INSERT INTO expenses
              (trip_id, payer_member_id, amount, description, expense_date, photo_path, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        input.tripId,
        p.payerMemberId,
        p.amount,
        p.description,
        input.expenseDate,
        input.photoPath ?? null,
        actingUserId,
      ],
    });
    const expenseId = Number(exp.rows[0].id);
    for (const memberId of p.included) {
      await tx.execute({
        sql: "INSERT INTO expense_shares (expense_id, member_id) VALUES (?, ?)",
        args: [expenseId, memberId],
      });
    }
    await tx.commit();
    return expenseId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** Edit an existing expense (R5). Only the payer or trip creator may do so. */
export async function updateExpense(
  expenseId: number,
  input: ExpenseFields,
  actingUserId: number,
  client: Client = db(),
): Promise<number> {
  const ctx = await getExpenseContext(expenseId, client);
  if (!ctx) throw new ExpenseError("Expense not found");
  if (!canModify(ctx, actingUserId)) {
    throw new ExpenseError("Only the payer or the trip creator can edit this expense");
  }
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
    for (const memberId of p.included) {
      await tx.execute({
        sql: "INSERT INTO expense_shares (expense_id, member_id) VALUES (?, ?)",
        args: [expenseId, memberId],
      });
    }
    await tx.commit();
    return ctx.tripId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** Delete an expense (R5). Only the payer or trip creator may do so. Returns the trip id. */
export async function deleteExpense(
  expenseId: number,
  actingUserId: number,
  client: Client = db(),
): Promise<number> {
  const ctx = await getExpenseContext(expenseId, client);
  if (!ctx) throw new ExpenseError("Expense not found");
  if (!canModify(ctx, actingUserId)) {
    throw new ExpenseError("Only the payer or the trip creator can delete this expense");
  }
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
      sql: `SELECT id, payer_member_id, amount, description, expense_date, photo_path, created_by_user_id
              FROM expenses WHERE trip_id = ?
             ORDER BY expense_date DESC, id DESC`,
      args: [tripId],
    }),
    client.execute({
      sql: `SELECT es.expense_id, es.member_id
              FROM expense_shares es
              JOIN expenses e ON e.id = es.expense_id
             WHERE e.trip_id = ?`,
      args: [tripId],
    }),
  ]);

  const sharesByExpense = new Map<number, number[]>();
  for (const row of shares.rows) {
    const eid = Number(row.expense_id);
    const list = sharesByExpense.get(eid) ?? [];
    list.push(Number(row.member_id));
    sharesByExpense.set(eid, list);
  }

  return expenses.rows.map((r) => ({
    id: Number(r.id),
    payerMemberId: Number(r.payer_member_id),
    amount: String(r.amount),
    description: String(r.description),
    expenseDate: String(r.expense_date),
    photoPath: (r.photo_path as string | null) ?? null,
    createdByUserId: Number(r.created_by_user_id),
    includedMemberIds: sharesByExpense.get(Number(r.id)) ?? [],
  }));
}
