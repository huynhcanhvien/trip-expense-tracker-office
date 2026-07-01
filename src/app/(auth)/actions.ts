"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { createUser, AccountError } from "@/lib/accounts";

export interface FormState {
  error?: string;
}

/** Register a new account, then send the user to login (spec R8). */
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: "Passwords do not match" };

  try {
    await createUser(email, password);
  } catch (err) {
    if (err instanceof AccountError) return { error: err.message };
    throw err;
  }

  // Outside the try so the redirect's control-flow throw isn't swallowed.
  redirect("/login?registered=1");
}

/** Log in with email + password. */
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    // AuthError = bad credentials; anything else (incl. the NEXT_REDIRECT on
    // success) must propagate.
    if (err instanceof AuthError) return { error: "Wrong email or password" };
    throw err;
  }

  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
