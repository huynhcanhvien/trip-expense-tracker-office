import ResetForm from "./ResetForm";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="auth-page">
      <h1>Choose a new password</h1>
      <ResetForm token={token} />
    </main>
  );
}
