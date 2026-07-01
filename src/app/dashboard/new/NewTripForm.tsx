"use client";

import { useActionState } from "react";
import { createTripAction, type TripFormState } from "@/app/trips/actions";
import { SUPPORTED_CURRENCIES, CURRENCY_META } from "@/lib/currency";

const initial: TripFormState = {};

export default function NewTripForm() {
  const [state, action, pending] = useActionState(createTripAction, initial);

  return (
    <form action={action} className="auth-form">
      <label>
        Trip name
        <input type="text" name="name" required maxLength={120} placeholder="e.g. Tokyo 2026" />
      </label>

      <label>
        Currency
        <select name="currency" defaultValue="USD" required>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} — {CURRENCY_META[c].label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Start date <span className="muted">(optional)</span>
        <input type="date" name="dateStart" />
      </label>
      <label>
        End date <span className="muted">(optional)</span>
        <input type="date" name="dateEnd" />
      </label>

      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}
