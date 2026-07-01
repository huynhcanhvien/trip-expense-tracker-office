import Link from "next/link";
import { consumeEmailVerificationToken } from "@/lib/tokens";

// Consumes the single-use verification token and marks the email verified (R8).
export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await consumeEmailVerificationToken(token);
  const ok = userId !== null;

  return (
    <main className="auth-page">
      <h1>{ok ? "Email verified" : "Verification failed"}</h1>
      {ok ? (
        <>
          <p className="form-success">Your email is verified — you can log in now.</p>
          <p className="auth-links">
            <Link href="/login">Go to login</Link>
          </p>
        </>
      ) : (
        <>
          <p className="form-error">
            This verification link is invalid or has already been used.
          </p>
          <p className="auth-links">
            <Link href="/register">Register again</Link> · <Link href="/login">Log in</Link>
          </p>
        </>
      )}
    </main>
  );
}
