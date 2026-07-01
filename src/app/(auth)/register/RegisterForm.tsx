"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "../actions";

const initial: FormState = {};

export default function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  return (
    <form action={action} className="auth-form">
      <label>
        Email
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <label>
        Password
        <input type="password" name="password" required autoComplete="new-password" minLength={8} />
      </label>
      <label>
        Confirm password
        <input type="password" name="confirm" required autoComplete="new-password" minLength={8} />
      </label>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
