import Link from "next/link";
import ForgotForm from "./ForgotForm";

export default function ForgotPage() {
  return (
    <main className="auth-page">
      <h1>Reset your password</h1>
      <p className="muted">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotForm />
      <p className="auth-links">
        <Link href="/login">Back to login</Link>
      </p>
    </main>
  );
}
