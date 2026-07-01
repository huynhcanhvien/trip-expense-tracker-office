import { logoutAction } from "@/app/(auth)/actions";

export default function Header({ email }: { email?: string | null }) {
  return (
    <header className="app-header">
      <span className="app-brand">✨ Trip Splitter</span>
      <div className="app-header-right">
        {email && <span className="app-user">{email}</span>}
        <form action={logoutAction}>
          <button type="submit">Log out</button>
        </form>
      </div>
    </header>
  );
}
