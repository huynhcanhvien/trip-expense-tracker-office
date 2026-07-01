"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { createUser, verifyCredentials, AccountError } from "@/lib/accounts";
import { issueEmailVerification } from "@/lib/verification";

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
    const user = await createUser(email, password);
    await issueEmailVerification(user);
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

  // Pre-check so we can distinguish "wrong credentials" from "not verified yet"
  // (authorize() also hard-blocks unverified sign-ins).
  const user = await verifyCredentials(email, password);
  if (!user) return { error: "Wrong email or password" };
  if (!user.emailVerified) {
    return { error: "Please verify your email — check your inbox for the link." };
  }

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
