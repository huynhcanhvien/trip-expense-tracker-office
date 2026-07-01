"use client";

import { useActionState, useEffect, useRef } from "react";
import { addExpenseAction, type ExpenseFormState } from "./expense-actions";

const initial: ExpenseFormState = {};

export interface MemberOption {
  id: number;
  displayName: string;
}

export default function AddExpenseForm({
  tripId,
  members,
  today,
}: {
  tripId: number;
  members: MemberOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(addExpenseAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="expense-form">
      <input type="hidden" name="tripId" value={tripId} />

      <label>
        Description
        <input type="text" name="description" required maxLength={200} placeholder="e.g. Dinner" />
      </label>

      <div className="field-row">
        <label>
          Amount
          <input type="text" name="amount" required inputMode="decimal" placeholder="0.00" />
        </label>
        <label>
          Date
          <input type="date" name="expenseDate" required defaultValue={today} />
        </label>
      </div>

      <label>
        Paid by
        <select name="payerMemberId" required defaultValue="">
          <option value="" disabled>
            Choose payer…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="split-set">
        <legend>Split between</legend>
        {members.map((m) => (
          <label key={m.id} className="check">
            <input type="checkbox" name="included" value={m.id} defaultChecked />
            {m.displayName}
          </label>
        ))}
      </fieldset>

      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add expense"}
      </button>
    </form>
  );
}
