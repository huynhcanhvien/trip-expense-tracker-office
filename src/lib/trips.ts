// Trip creation + access helpers — spec R6, scenario D.
import type { Client } from "@libsql/client";
import { z } from "zod";
import { db } from "./db";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "./currency";
import { generateToken } from "./tokens";
import { storage } from "./storage";

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

export interface TripListItem extends TripRow {
  memberCount: number;
}

/** All trips the user is a member of, newest first, with member counts (scenario B). */
export async function listTripsForUser(
  userId: number,
  client: Client = db(),
): Promise<TripListItem[]> {
  const res = await client.execute({
    sql: `SELECT t.*,
                 (SELECT COUNT(*) FROM trip_members m WHERE m.trip_id = t.id) AS member_count
            FROM trips t
            JOIN trip_members tm ON tm.trip_id = t.id
           WHERE tm.user_id = ?
           ORDER BY t.created_at DESC, t.id DESC`,
    args: [userId],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    date_start: (r.date_start as string | null) ?? null,
    date_end: (r.date_end as string | null) ?? null,
    currency: r.currency as CurrencyCode,
    creator_user_id: Number(r.creator_user_id),
    status: r.status as "open" | "closed",
    closed_at: (r.closed_at as string | null) ?? null,
    created_at: String(r.created_at),
    memberCount: Number(r.member_count),
  }));
}

export interface TripMemberRow {
  id: number;
  userId: number | null;
  isGhost: boolean;
  displayName: string;
}

/** List a trip's members (registered + ghosts), ordered by join order. */
export async function listTripMembers(
  tripId: number,
  client: Client = db(),
): Promise<TripMemberRow[]> {
  const res = await client.execute({
    sql: `SELECT tm.id, tm.user_id, tm.ghost_name, u.email
            FROM trip_members tm
            LEFT JOIN users u ON u.id = tm.user_id
           WHERE tm.trip_id = ?
           ORDER BY tm.id`,
    args: [tripId],
  });
  return res.rows.map((r) => {
    const isGhost = r.user_id == null;
    return {
      id: Number(r.id),
      userId: isGhost ? null : Number(r.user_id),
      isGhost,
      displayName: isGhost ? String(r.ghost_name) : String(r.email),
    };
  });
}

/** The reusable invitation token for a trip (R1), or null if missing. */
export async function getInvitationToken(
  tripId: number,
  client: Client = db(),
): Promise<string | null> {
  const res = await client.execute({
    sql: "SELECT token FROM invitation_tokens WHERE trip_id = ?",
    args: [tripId],
  });
  return res.rows[0] ? String(res.rows[0].token) : null;
}

/**
 * Close (archive) a trip — spec R9. Creator-only, permanent and one-way. Sets
 * status='closed', deletes all receipt photos and nulls their photo_path. Never
 * blocks on non-zero balances (the UI warns; the app never tracks real payment).
 */
export async function closeTrip(
  tripId: number,
  actingUserId: number,
  client: Client = db(),
): Promise<void> {
  const trip = await getTripForUser(tripId, actingUserId, client);
  if (!trip) throw new TripError("You're not a member of this trip");
  if (trip.creator_user_id !== actingUserId) {
    throw new TripError("Only the trip creator can close this trip");
  }
  if (trip.status === "closed") throw new TripError("This trip is already closed");

  const photos = await client.execute({
    sql: "SELECT photo_path FROM expenses WHERE trip_id = ? AND photo_path IS NOT NULL",
    args: [tripId],
  });

  // Update the DB first so state is consistent even if a file delete fails.
  const tx = await client.transaction("write");
  try {
    await tx.execute({ sql: "UPDATE expenses SET photo_path = NULL WHERE trip_id = ?", args: [tripId] });
    await tx.execute({
      sql: "UPDATE trips SET status = 'closed', closed_at = datetime('now') WHERE id = ?",
      args: [tripId],
    });
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  // Best-effort deletion of the now-orphaned photo files (R4/R9).
  for (const row of photos.rows) {
    await storage.delete(String(row.photo_path));
  }
}

/** Human-readable date range for a trip, or null if no dates set. */
export function formatTripDates(trip: {
  date_start: string | null;
  date_end: string | null;
}): string | null {
  if (trip.date_start && trip.date_end) return `${trip.date_start} → ${trip.date_end}`;
  if (trip.date_start) return `from ${trip.date_start}`;
  if (trip.date_end) return `until ${trip.date_end}`;
  return null;
}

/** Resolve a trip from its reusable invite token (R1), or null if the token is unknown. */
export async function getTripByInviteToken(
  token: string,
  client: Client = db(),
): Promise<TripRow | null> {
  if (!token) return null;
  const res = await client.execute({
    sql: `SELECT t.* FROM trips t
            JOIN invitation_tokens it ON it.trip_id = t.id
           WHERE it.token = ?`,
    args: [token],
  });
  return (res.rows[0] as unknown as TripRow) ?? null;
}

export async function isMember(
  tripId: number,
  userId: number,
  client: Client = db(),
): Promise<boolean> {
  const res = await client.execute({
    sql: "SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ? LIMIT 1",
    args: [tripId, userId],
  });
  return res.rows.length > 0;
}

export async function countExpenses(tripId: number, client: Client = db()): Promise<number> {
  const res = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM expenses WHERE trip_id = ?",
    args: [tripId],
  });
  return Number(res.rows[0].c);
}

/**
 * Add a registered user to a trip (accept invite, R1). Idempotent: the unique
 * (trip_id, user_id) index + INSERT OR IGNORE means re-accepting never duplicates.
 */
export async function addTripMember(
  tripId: number,
  userId: number,
  client: Client = db(),
): Promise<void> {
  await client.execute({
    sql: "INSERT OR IGNORE INTO trip_members (trip_id, user_id) VALUES (?, ?)",
    args: [tripId, userId],
  });
}

/**
 * Add a ghost member (by name only) to a trip — spec R1 ghost path. Any trip
 * member may add one (round-3 decision). Throws TripError if the acting user
 * isn't a member, the trip is archived, or the name is empty.
 */
export async function addGhostMember(
  tripId: number,
  name: string,
  actingUserId: number,
  client: Client = db(),
): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new TripError("Guest name is required");
  if (clean.length > 80) throw new TripError("Name is too long");

  const trip = await getTripForUser(tripId, actingUserId, client);
  if (!trip) throw new TripError("You're not a member of this trip");
  if (trip.status === "closed") throw new TripError("This trip is archived");

  await client.execute({
    sql: "INSERT INTO trip_members (trip_id, ghost_name) VALUES (?, ?)",
    args: [tripId, clean],
  });
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
