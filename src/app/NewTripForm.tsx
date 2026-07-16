"use client";

import { useActionState } from "react";
import { createTripAction, type TripFormState } from "@/app/trips/actions";
import { SUPPORTED_CURRENCIES, CURRENCY_META } from "@/lib/currency";
import SubmitButton from "@/app/components/SubmitButton";
import FormError from "@/app/components/FormError";
import Select from "@/app/components/Select";

const initial: TripFormState = {};

export default function NewTripForm() {
  const [state, action] = useActionState(createTripAction, initial);

  return (
    <form action={action} className="auth-form">
      <label>
        Trip name
        <input type="text" name="name" required maxLength={120} placeholder="e.g. Tokyo 2026" />
      </label>

      <label>
        Currency
        <Select name="currency" defaultValue="USD" required>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_META[c].flag} {c}
            </option>
          ))}
        </Select>
      </label>

      <FormError message={state.error} />
      <SubmitButton label="Create trip" pendingLabel="Creating…" />
    </form>
  );
}
