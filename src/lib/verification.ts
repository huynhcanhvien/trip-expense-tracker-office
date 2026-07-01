// Compose + send the email-verification message (spec R8). Ties together
// tokens.ts (token) and email.ts (delivery).
import type { Client } from "@libsql/client";
import { db } from "./db";
import { createEmailVerificationToken, createPasswordResetToken } from "./tokens";
import { sendEmail } from "./email";
import { baseUrl } from "./urls";

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

/** Create a password reset token for the user and email them the link (spec R10). */
export async function issuePasswordReset(
  user: { id: number; email: string },
  client: Client = db(),
): Promise<void> {
  const token = await createPasswordResetToken(user.id, client);
  const url = `${baseUrl()}/reset/${token}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your Trip Splitter password",
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${url}">Choose a new password</a></p>
      <p>Or paste this link into your browser:<br>${url}</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
    text: `Reset your Trip Splitter password: ${url}`,
  });
}
