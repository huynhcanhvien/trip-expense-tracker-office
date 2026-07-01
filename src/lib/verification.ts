// Compose + send the email-verification message (spec R8). Ties together
// tokens.ts (token) and email.ts (delivery).
import type { Client } from "@libsql/client";
import { db } from "./db";
import { createEmailVerificationToken } from "./tokens";
import { sendEmail } from "./email";

/** App base URL for building links in emails. */
export function baseUrl(): string {
  return process.env.AUTH_URL || "http://localhost:3000";
}

/** Create a verification token for the user and email them the link. */
export async function issueEmailVerification(
  user: { id: number; email: string },
  client: Client = db(),
): Promise<void> {
  const token = await createEmailVerificationToken(user.id, client);
  const url = `${baseUrl()}/verify/${token}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your email for Trip Splitter",
    html: `
      <p>Welcome to Trip Splitter!</p>
      <p>Confirm your email address to activate your account:</p>
      <p><a href="${url}">Verify my email</a></p>
      <p>Or paste this link into your browser:<br>${url}</p>
    `,
    text: `Verify your email for Trip Splitter: ${url}`,
  });
}
