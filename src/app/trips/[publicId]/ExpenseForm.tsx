"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Big from "big.js";
import {
  addExpenseAction,
  updateExpenseAction,
  type ExpenseFormState,
} from "./expense-actions";
import SubmitButton from "@/app/components/SubmitButton";
import FormError from "@/app/components/FormError";
import Select from "@/app/components/Select";
import { decimalPlaces, formatAmount, type CurrencyCode } from "@/lib/currency";

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
  /** memberId → exact amount when the expense was saved with a custom split. */
  customShares?: Record<number, string> | null;
}

// Prefill for the OCR review flow (add mode): fields filled, but payer is NOT
// assumed (spec R4 — don't assume the uploader paid).
export interface PrefillExpense {
  description: string;
  amount: string;
  expenseDate: string;
  photoPath: string;
}

/** Parse a decimal string to Big, or null if blank/invalid. */
function toBig(value: string | undefined): Big | null {
  const s = (value ?? "").trim();
  if (!s) return null;
  try {
    return new Big(s);
  } catch {
    return null;
  }
}

export default function ExpenseForm({
  publicId,
  members,
  currency,
  today,
  editing,
  prefill,
  defaultPayerId,
  onSuccess,
}: {
  publicId: string;
  members: MemberOption[];
  currency: CurrencyCode;
  today: string;
  editing?: EditingExpense;
  prefill?: PrefillExpense;
  /** Preselect "you" as the payer for a fresh manual expense. */
  defaultPayerId?: number | null;
  onSuccess?: () => void;
}) {
  const isEdit = Boolean(editing);
  const dp = decimalPlaces(currency);
  const [state, action] = useActionState(
    isEdit ? updateExpenseAction : addExpenseAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const descDefault = editing?.description ?? prefill?.description ?? "";
  const dateDefault = editing?.expenseDate ?? prefill?.expenseDate ?? today;
  // Payer: edit keeps its payer; OCR review assumes nobody (R4); a fresh manual
  // expense defaults to "you" if known.
  const payerDefault = editing?.payerMemberId ?? (prefill ? "" : defaultPayerId ?? "");

  // The total is controlled so the custom split can react to it (auto-fill).
  const [amount, setAmount] = useState(editing?.amount ?? prefill?.amount ?? "");

  // Split mode + its two backing states. An edit that was saved custom reopens
  // in custom mode with its per-person amounts prefilled.
  const [mode, setMode] = useState<"even" | "custom">(
    editing?.customShares ? "custom" : "even",
  );
  const includedSet = new Set(editing?.includedMemberIds ?? members.map((m) => m.id));
  const [shares, setShares] = useState<Record<number, string>>(() => {
    const seed: Record<number, string> = {};
    if (editing?.customShares) {
      for (const [id, amt] of Object.entries(editing.customShares)) seed[Number(id)] = amt;
    }
    return seed;
  });

  // One member is the "worked out for you" slot: total − (sum of the others).
  // We remember which one (autoId) so it keeps recomputing on every keystroke —
  // whether the user edits another share or the total — not just while it's
  // blank. It's claimed as soon as exactly one field is left empty, and released
  // the moment the user types into it directly.
  const [autoId, setAutoId] = useState<number | null>(null);

  // Recompute the auto slot from the other shares. `next`/`totalStr` are the
  // just-edited values; `currentAuto` is the slot to fill; `editingId` is the
  // field the user is actively typing in (never overwrite that one).
  const recompute = (
    next: Record<number, string>,
    totalStr: string,
    currentAuto: number | null,
    editingId?: number,
  ): { shares: Record<number, string>; autoId: number | null } => {
    let target = currentAuto;
    if (target == null) {
      // No slot yet: claim the sole blank field (unless it's the one being typed).
      const blanks = members.filter((m) => !(next[m.id] ?? "").trim());
      if (blanks.length === 1 && blanks[0].id !== editingId) target = blanks[0].id;
    }

    const total = toBig(totalStr);
    if (target == null || target === editingId || !total) {
      return { shares: next, autoId: target };
    }

    let othersSum = new Big(0);
    for (const m of members) {
      if (m.id === target) continue;
      const b = toBig(next[m.id]);
      if (!b) return { shares: next, autoId: target }; // an "other" is blank/invalid
      othersSum = othersSum.plus(b);
    }

    const remaining = total.minus(othersSum);
    if (remaining.lt(0)) return { shares: next, autoId: target }; // others exceed total
    return {
      shares: { ...next, [target]: remaining.round(dp, Big.roundHalfUp).toString() },
      autoId: target,
    };
  };

  const onShareChange = (id: number, value: string) => {
    // Typing into the auto slot means the user is taking it over — release it.
    const result = recompute({ ...shares, [id]: value }, amount, id === autoId ? null : autoId, id);
    setShares(result.shares);
    setAutoId(result.autoId);
  };

  const onAmountChange = (value: string) => {
    setAmount(value);
    const result = recompute(shares, value, autoId);
    setShares(result.shares);
    setAutoId(result.autoId);
  };

  // Live "remaining / adds up" hint for the custom split.
  const remaining = useMemo(() => {
    const total = toBig(amount);
    if (!total) return null;
    let sum = new Big(0);
    for (const m of members) {
      const b = toBig(shares[m.id]);
      if (b) sum = sum.plus(b);
    }
    return total.minus(sum);
  }, [amount, shares, members]);

  // Only the add form stays on the page; clear it after a successful add and
  // let the host (e.g. the dialog) react (close itself). The controlled fields
  // (amount/shares/mode) must be reset explicitly since the form stays mounted
  // when the dialog hides — resetting in response to the async action result is
  // exactly what this effect is for.
  useEffect(() => {
    if (state.ok && !isEdit) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount("");
      setShares({});
      setAutoId(null);
      setMode("even");
      onSuccess?.();
    }
  }, [state, isEdit, onSuccess]);

  return (
    <form ref={formRef} action={action} className="expense-form">
      <input type="hidden" name="publicId" value={publicId} />
      {editing && <input type="hidden" name="expenseId" value={editing.id} />}
      {prefill && <input type="hidden" name="photoPath" value={prefill.photoPath} />}
      <input type="hidden" name="splitMode" value={mode} />

      <label>
        Description
        <input
          type="text"
          name="description"
          required
          maxLength={200}
          placeholder="e.g. Dinner"
          defaultValue={descDefault}
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
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
          />
        </label>
        <label>
          Date
          <input type="date" name="expenseDate" required defaultValue={dateDefault} />
        </label>
      </div>

      <label>
        Paid by
        <Select name="payerMemberId" required defaultValue={payerDefault}>
          <option value="" disabled>
            Choose payer…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </Select>
      </label>

      {/* How to split: an equal share of the total, or a per-person amount. */}
      <div className="seg" role="tablist" aria-label="How to split">
        <button
          type="button"
          className={mode === "even" ? "seg-btn active" : "seg-btn"}
          aria-pressed={mode === "even"}
          onClick={() => setMode("even")}
        >
          ⚖️ Split evenly
        </button>
        <button
          type="button"
          className={mode === "custom" ? "seg-btn active" : "seg-btn"}
          aria-pressed={mode === "custom"}
          onClick={() => setMode("custom")}
        >
          🔢 Custom amounts
        </button>
      </div>

      {mode === "even" ? (
        <fieldset className="split-set">
          <legend>Split between</legend>
          {members.map((m) => (
            <label key={m.id} className="check">
              <input
                type="checkbox"
                name="included"
                value={m.id}
                defaultChecked={includedSet.has(m.id)}
              />
              {m.displayName}
            </label>
          ))}
        </fieldset>
      ) : (
        <fieldset className="split-set">
          <legend>Amount per person</legend>
          <p className="muted split-hint">
            Fill in everyone but one — the last is worked out for you.
          </p>
          {members.map((m) => (
            <label key={m.id} className="share-row">
              <span className="share-name">{m.displayName}</span>
              <input
                type="text"
                inputMode="decimal"
                name={`share_${m.id}`}
                placeholder="0.00"
                value={shares[m.id] ?? ""}
                onChange={(e) => onShareChange(m.id, e.target.value)}
              />
            </label>
          ))}
          {remaining != null && (
            <p className={remaining.eq(0) ? "split-remaining ok" : "split-remaining"}>
              {remaining.eq(0)
                ? "✓ Adds up to the total"
                : remaining.gt(0)
                  ? `${formatAmount(remaining, currency)} left to assign`
                  : `${formatAmount(remaining.times(-1), currency)} over the total`}
            </p>
          )}
        </fieldset>
      )}

      <FormError message={state.error} />
      <SubmitButton label={isEdit ? "Save changes" : "Add expense"} pendingLabel="Saving…" />
    </form>
  );
}
