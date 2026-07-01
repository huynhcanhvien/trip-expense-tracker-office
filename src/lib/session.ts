import { redirect } from "next/navigation";
import { auth } from "./auth";
import { getUserById } from "./accounts";

/**
 * Resolve the current user's id for a mutating action, or redirect to /login.
 * Also guards against a *stale* session — a valid JWT whose user no longer
 * exists in the DB (e.g. after the account was removed / DB reset) — so such a
 * request cleanly re-authenticates instead of failing a foreign-key insert.
 */
export async function requireUserId(): Promise<number> {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!session?.user || !Number.isFinite(id)) redirect("/login");

  const user = await getUserById(id);
  if (!user) redirect("/login");

  return id;
}
