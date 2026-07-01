"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addExpenseAction,
  updateExpenseAction,
  type ExpenseFormState,
} from "./expense-actions";

const initial: ExpenseFormState = {};

export interface MemberOption {
  id: number;
  displayName: string;
}

export interface EditingExpense {
  id: number;
  description: string;
  amount: string;
  expenseDate: string;
  payerMemberId: number;
  includedMemberIds: number[];
}

export default function ExpenseForm({
  tripId,
  members,
  today,
  editing,
}: {
  tripId: number;
  members: MemberOption[];
  today: string;
  editing?: EditingExpense;
}) {
  const isEdit = Boolean(editing);
  const [state, action, pending] = useActionState(
    isEdit ? updateExpenseAction : addExpenseAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const includedSet = new Set(editing?.includedMemberIds ?? members.map((m) => m.id));

  // Only the add form stays on the page; clear it after a successful add.
  useEffect(() => {
    if (state.ok && !isEdit) formRef.current?.reset();
  }, [state, isEdit]);

  return (
    <form ref={formRef} action={action} className="expense-form">
      <input type="hidden" name="tripId" value={tripId} />
      {editing && <input type="hidden" name="expenseId" value={editing.id} />}

      <label>
        Description
        <input
          type="text"
          name="description"
          required
          maxLength={200}
          placeholder="e.g. Dinner"
          defaultValue={editing?.description ?? ""}
        />
      </label>

      <div className="field-row">
        <label>
          Amount
          <input
            type="text"
            name="amount"
            required
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={editing?.amount ?? ""}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            name="expenseDate"
            required
            defaultValue={editing?.expenseDate ?? today}
          />
        </label>
      </div>

      <label>
        Paid by
        <select name="payerMemberId" required defaultValue={editing?.payerMemberId ?? ""}>
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
            <input type="checkbox" name="included" value={m.id} defaultChecked={includedSet.has(m.id)} />
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
        {pending ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
      </button>
    </form>
  );
}
