"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createTrip,
  getTripByPublicId,
  getTripSummaries,
  addParticipant,
  closeTrip,
  type TripSummary,
  TripError,
} from "@/lib/trips";
import type { CurrencyCode } from "@/lib/currency";

export interface TripFormState {
  error?: string;
  ok?: boolean;
  /** trip_members.id of a just-added participant (used to claim "you"). */
  memberId?: number;
}

/** Create a trip (no account needed), then go to its shareable page. */
export async function createTripAction(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const name = String(formData.get("name") ?? "");
  const currency = String(formData.get("currency") ?? "") as CurrencyCode;
  const participants = formData
    .getAll("participants")
    .map((v) => String(v).trim())
    .filter(Boolean);

  let publicId: string;
  try {
    publicId = await createTrip({ name, currency, participants });
  } catch (err) {
    if (err instanceof TripError) return { error: err.message };
    throw err;
  }

  redirect(`/trips/${publicId}`);
}

/** Add a participant (by name) to a trip. Anyone with the link may do this. */
export async function addParticipantAction(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const publicId = String(formData.get("publicId") ?? "");
  const name = String(formData.get("name") ?? "");

  const trip = await getTripByPublicId(publicId);
  if (!trip) return { error: "Trip not found" };

  let memberId: number;
  try {
    memberId = await addParticipant(trip.id, name);
  } catch (err) {
    if (err instanceof TripError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/trips/${publicId}`);
  return { ok: true, memberId };
}

/** Close (archive) a trip — permanent, one-way. */
export async function closeTripAction(formData: FormData): Promise<void> {
  const publicId = String(formData.get("publicId") ?? "");
  const trip = await getTripByPublicId(publicId);
  if (!trip) redirect("/");

  await closeTrip(trip.id);

  revalidatePath(`/trips/${publicId}`);
  redirect(`/trips/${publicId}`);
}

/** Fresh summaries for the browser's "recent trips" home page. */
export async function fetchTripSummariesAction(
  publicIds: string[],
): Promise<Pick<TripSummary, "public_id" | "name" | "currency" | "status" | "memberCount">[]> {
  const summaries = await getTripSummaries(publicIds);
  return summaries.map((t) => ({
    public_id: t.public_id,
    name: t.name,
    currency: t.currency,
    status: t.status,
    memberCount: t.memberCount,
  }));
}
