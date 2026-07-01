"use client";

import { useActionState } from "react";
import { forgotAction, type ForgotState } from "../actions";

const initial: ForgotState = {};

export default function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, initial);

  if (state.sent) {
    return (
      <p role="status" className="form-success">
        If an account exists for that email, we&apos;ve sent a password reset link. Check your
        inbox.
      </p>
    );
  }

  return (
    <form action={action} className="auth-form">
      <label>
        Email
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
