"use client";

import { useActionState } from "react";
import { resetAction, type FormState } from "../../actions";

const initial: FormState = {};

export default function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetAction, initial);

  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="token" value={token} />
      <label>
        New password
        <input type="password" name="password" required autoComplete="new-password" minLength={8} />
      </label>
      <label>
        Confirm new password
        <input type="password" name="confirm" required autoComplete="new-password" minLength={8} />
      </label>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
