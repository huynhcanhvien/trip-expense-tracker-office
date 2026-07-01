import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Header from "@/app/components/Header";

// Placeholder dashboard (T5). The real trip listing lands in T9.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <>
      <Header email={session.user.email} />
      <main className="page">
        <h1>Your trips</h1>
        <p className="muted">You&apos;re logged in as {session.user.email}.</p>
        <p className="muted">Trip listing arrives in T9.</p>
      </main>
    </>
  );
}
