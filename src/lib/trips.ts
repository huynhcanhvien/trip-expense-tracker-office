// Trip creation + access helpers — no-auth, spliit-style. A trip is reached by
// its shareable secret slug (public_id); anyone with the link may view/edit it.
import type { Client } from "@libsql/client";
import { z } from "zod";
import { db } from "./db";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "./currency";
import { generateToken } from "./tokens";
import { storage } from "./storage";

/** A user-facing error (safe to show in the UI). */
export class TripError extends Error {}

const createTripSchema = z.object({
  name: z.string().trim().min(1, "Trip name is required").max(120, "Name is too long"),
  currency: z.enum(SUPPORTED_CURRENCIES as [CurrencyCode, ...CurrencyCode[]], {
    message: "Choose a supported currency",
  }),
  // Optional participant names entered on the create form (spliit-style).
  participants: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
});

export type CreateTripInput = z.input<typeof createTripSchema>;

export interface TripRow {
  id: number;
  public_id: string;
  name: string;
  currency: CurrencyCode;
  status: "open" | "closed";
  closed_at: string | null;
  created_at: string;
}

function rowToTrip(r: Record<string, unknown>): TripRow {
  return {
    id: Number(r.id),
    public_id: String(r.public_id),
    name: String(r.name),
    currency: r.currency as CurrencyCode,
    status: r.status as "open" | "closed",
    closed_at: (r.closed_at as string | null) ?? null,
    created_at: String(r.created_at),
  };
}

/**
 * Create a trip and return its public_id (the shareable slug used in the URL).
 * Inserts the trip plus any participants named on the create form, in one
 * transaction. Throws TripError on invalid input.
 */
export async function createTrip(
  input: CreateTripInput,
  client: Client = db(),
): Promise<string> {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    throw new TripError(parsed.error.issues[0]?.message ?? "Invalid trip details");
  }
  const { name, currency, participants } = parsed.data;
  const publicId = generateToken();

  // No two participants on the same trip may share a name (case-insensitive) —
  // balances are read by name, so duplicates would be ambiguous.
  const seen = new Set<string>();
  for (const person of participants ?? []) {
    const key = person.toLowerCase();
    if (seen.has(key)) {
      throw new TripError(`You've added "${person}" more than once — names must be unique`);
    }
    seen.add(key);
  }

  const tx = await client.transaction("write");
  try {
    const trip = await tx.execute({
      sql: `INSERT INTO trips (public_id, name, currency) VALUES (?, ?, ?) RETURNING id`,
      args: [publicId, name, currency],
    });
    const tripId = Number(trip.rows[0].id);

    for (const person of participants ?? []) {
      await tx.execute({
        sql: "INSERT INTO trip_members (trip_id, name) VALUES (?, ?)",
        args: [tripId, person],
      });
    }

    await tx.commit();
    return publicId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export interface TripSummary extends TripRow {
  memberCount: number;
}

/**
 * Summaries for a set of trips by public_id (for the browser's "recent trips"
 * home page). Unknown ids are simply omitted. Order follows `publicIds`.
 */
export async function getTripSummaries(
  publicIds: string[],
  client: Client = db(),
): Promise<TripSummary[]> {
  const ids = [...new Set(publicIds)].filter(Boolean);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const res = await client.execute({
    sql: `SELECT t.*,
                 (SELECT COUNT(*) FROM trip_members m WHERE m.trip_id = t.id) AS member_count
            FROM trips t
           WHERE t.public_id IN (${placeholders})`,
    args: ids,
  });

  const byId = new Map<string, TripSummary>();
  for (const r of res.rows) {
    byId.set(String(r.public_id), { ...rowToTrip(r), memberCount: Number(r.member_count) });
  }
  // Preserve the caller's order (most-recent-first from localStorage).
  return ids.map((id) => byId.get(id)).filter((t): t is TripSummary => Boolean(t));
}

export interface TripMemberRow {
  id: number;
  displayName: string;
}

/** List a trip's participants, in join order. */
export async function listTripMembers(
  tripId: number,
  client: Client = db(),
): Promise<TripMemberRow[]> {
  const res = await client.execute({
    sql: "SELECT id, name FROM trip_members WHERE trip_id = ? ORDER BY id",
    args: [tripId],
  });
  return res.rows.map((r) => ({ id: Number(r.id), displayName: String(r.name) }));
}

/**
 * Close (archive) a trip. Permanent and one-way. Sets status='closed', deletes
 * all receipt photos and nulls their photo_path. Never blocks on non-zero
 * balances (the UI warns; the app never tracks real payment).
 */
export async function closeTrip(tripId: number, client: Client = db()): Promise<void> {
  const trip = await getTripById(tripId, client);
  if (!trip) throw new TripError("Trip not found");
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

  // Best-effort deletion of the now-orphaned photo files.
  for (const row of photos.rows) {
    await storage.delete(String(row.photo_path));
  }
}

/** Fetch a trip by its shareable public_id, or null if unknown. */
export async function getTripByPublicId(
  publicId: string,
  client: Client = db(),
): Promise<TripRow | null> {
  if (!publicId) return null;
  const res = await client.execute({
    sql: "SELECT * FROM trips WHERE public_id = ?",
    args: [publicId],
  });
  return res.rows[0] ? rowToTrip(res.rows[0]) : null;
}

/** Fetch a trip by its internal id, or null if unknown. */
export async function getTripById(tripId: number, client: Client = db()): Promise<TripRow | null> {
  const res = await client.execute({ sql: "SELECT * FROM trips WHERE id = ?", args: [tripId] });
  return res.rows[0] ? rowToTrip(res.rows[0]) : null;
}

export async function countExpenses(tripId: number, client: Client = db()): Promise<number> {
  const res = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM expenses WHERE trip_id = ?",
    args: [tripId],
  });
  return Number(res.rows[0].c);
}

/**
 * Add a participant (by name) to a trip. Throws TripError if the trip is
 * missing, archived, or the name is empty/too long. Returns the new member id.
 */
export async function addParticipant(
  tripId: number,
  name: string,
  client: Client = db(),
): Promise<number> {
  const clean = name.trim();
  if (!clean) throw new TripError("Name is required");
  if (clean.length > 80) throw new TripError("Name is too long");

  const trip = await getTripById(tripId, client);
  if (!trip) throw new TripError("Trip not found");
  if (trip.status === "closed") throw new TripError("This trip is archived");

  // Names must be unique within a trip (case-insensitive) — see createTrip.
  const dup = await client.execute({
    sql: "SELECT 1 FROM trip_members WHERE trip_id = ? AND name = ? COLLATE NOCASE LIMIT 1",
    args: [tripId, clean],
  });
  if (dup.rows.length > 0) {
    throw new TripError(`Someone on this trip is already called "${clean}"`);
  }

  const res = await client.execute({
    sql: "INSERT INTO trip_members (trip_id, name) VALUES (?, ?) RETURNING id",
    args: [tripId, clean],
  });
  return Number(res.rows[0].id);
}
