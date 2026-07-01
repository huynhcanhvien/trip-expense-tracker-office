"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createTrip, TripError } from "@/lib/trips";
import type { CurrencyCode } from "@/lib/currency";

export interface TripFormState {
  error?: string;
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
