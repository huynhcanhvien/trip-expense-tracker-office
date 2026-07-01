"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createTrip,
  getTripByInviteToken,
  addTripMember,
  addGhostMember,
  TripError,
} from "@/lib/trips";
import type { CurrencyCode } from "@/lib/currency";

export interface TripFormState {
  error?: string;
  ok?: boolean;
}

/** Create a trip for the logged-in user, then go to its page (scenario D, R6). */
export async function createTripAction(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = String(formData.get("name") ?? "");
  const currency = String(formData.get("currency") ?? "") as CurrencyCode;
  const dateStart = String(formData.get("dateStart") ?? "").trim() || undefined;
  const dateEnd = String(formData.get("dateEnd") ?? "").trim() || undefined;

  let tripId: number;
  try {
    tripId = await createTrip({ name, currency, dateStart, dateEnd }, Number(session.user.id));
  } catch (err) {
    if (err instanceof TripError) return { error: err.message };
    throw err;
  }

  redirect(`/trips/${tripId}`);
}

/** Accept a trip invitation (scenario F). Adds the current user, then goes to the trip. */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const trip = await getTripByInviteToken(token);
  if (!trip || trip.status === "closed") {
    // Token vanished or trip closed between preview and accept.
    redirect(`/invite/${token}`);
  }

  await addTripMember(trip.id, Number(session.user.id));
  redirect(`/trips/${trip.id}`);
}

/** Add a ghost member by name (spec R1 ghost path). */
export async function addGhostAction(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tripId = Number(formData.get("tripId"));
  const name = String(formData.get("name") ?? "");

  try {
    await addGhostMember(tripId, name, Number(session.user.id));
  } catch (err) {
    if (err instanceof TripError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
