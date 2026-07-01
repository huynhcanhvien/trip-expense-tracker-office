import Link from "next/link";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <h1>Create an account</h1>
      <RegisterForm />
      <p className="auth-links">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
