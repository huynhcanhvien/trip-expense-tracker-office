import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Header from "@/app/components/Header";
import NewTripForm from "./NewTripForm";

export default async function NewTripPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <>
      <Header email={session.user.email} />
      <main className="page">
        <h1>New trip</h1>
        <NewTripForm />
        <p className="auth-links">
          <Link href="/dashboard">Cancel</Link>
        </p>
      </main>
    </>
  );
}
