import Link from "next/link";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  return (
    <main className="auth-page">
      <h1>Create an account</h1>
      <RegisterForm callbackUrl={callbackUrl} />
      <p className="auth-links">
        Already have an account? <Link href={loginHref}>Log in</Link>
      </p>
    </main>
  );
}
