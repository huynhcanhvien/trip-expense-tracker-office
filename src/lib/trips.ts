// Trip creation + access helpers — spec R6, scenario D.
import type { Client } from "@libsql/client";
import { z } from "zod";
import { db } from "./db";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "./currency";
import { generateToken } from "./tokens";

/** A user-facing error (safe to show in the UI). */
export class TripError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const createTripSchema = z
  .object({
    name: z.string().trim().min(1, "Trip name is required").max(120, "Name is too long"),
    currency: z.enum(SUPPORTED_CURRENCIES as [CurrencyCode, ...CurrencyCode[]], {
      message: "Choose a supported currency",
    }),
    dateStart: z.string().regex(DATE_RE, "Use a valid start date").optional(),
    dateEnd: z.string().regex(DATE_RE, "Use a valid end date").optional(),
  })
  .refine((d) => !(d.dateStart && d.dateEnd) || d.dateEnd >= d.dateStart, {
    message: "End date can't be before the start date",
    path: ["dateEnd"],
  });

export type CreateTripInput = z.input<typeof createTripSchema>;

export interface TripRow {
  id: number;
  name: string;
  date_start: string | null;
  date_end: string | null;
  currency: CurrencyCode;
  creator_user_id: number;
  status: "open" | "closed";
  closed_at: string | null;
  created_at: string;
}

/**
 * Create a trip (scenario D): inserts the Trip, a TripMember for the creator,
 * and the reusable InvitationToken (R1) — all in one transaction.
 * Returns the new trip id. Throws TripError on invalid input.
 */
export async function createTrip(
  input: CreateTripInput,
  creatorUserId: number,
  client: Client = db(),
): Promise<number> {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    throw new TripError(parsed.error.issues[0]?.message ?? "Invalid trip details");
  }
  const { name, currency, dateStart, dateEnd } = parsed.data;

  const tx = await client.transaction("write");
  try {
    const trip = await tx.execute({
      sql: `INSERT INTO trips (name, date_start, date_end, currency, creator_user_id)
            VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [name, dateStart ?? null, dateEnd ?? null, currency, creatorUserId],
    });
    const tripId = Number(trip.rows[0].id);

    await tx.execute({
      sql: "INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)",
      args: [tripId, creatorUserId],
    });
    await tx.execute({
      sql: "INSERT INTO invitation_tokens (trip_id, token) VALUES (?, ?)",
      args: [tripId, generateToken()],
    });

    await tx.commit();
    return tripId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** Fetch a trip only if the user is a member; otherwise null (don't leak existence). */
export async function getTripForUser(
  tripId: number,
  userId: number,
  client: Client = db(),
): Promise<TripRow | null> {
  const res = await client.execute({
    sql: `SELECT t.* FROM trips t
            JOIN trip_members tm ON tm.trip_id = t.id
           WHERE t.id = ? AND tm.user_id = ?`,
    args: [tripId, userId],
  });
  return (res.rows[0] as unknown as TripRow) ?? null;
}
