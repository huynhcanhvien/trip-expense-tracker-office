import Link from "next/link";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; reset?: string }>;
}) {
  const { registered, reset } = await searchParams;

  return (
    <main className="auth-page">
      <h1>Log in</h1>
      {registered && (
        <p role="status" className="form-success">
          Account created — check your email for a verification link, then log in.
        </p>
      )}
      {reset && (
        <p role="status" className="form-success">
          Password updated — please log in with your new password.
        </p>
      )}
      <LoginForm />
      <p className="auth-links">
        <Link href="/forgot">Forgot password?</Link>
        {" · "}
        <Link href="/register">Create an account</Link>
      </p>
    </main>
  );
}
