import { redirect } from "next/navigation";

// The dashboard is the app's home; it redirects to /login when unauthenticated.
export default function Home() {
  redirect("/dashboard");
}
