import { useState } from "react";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(name, email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <span className="logo-big">🌸</span>
        <h1>Petal</h1>
        <p className="tagline">the cutest way to split trip bills</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={submit}>
          {mode === "signup" && (
            <label className="field">
              <span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" autoFocus />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </label>
          <button className="btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? <span className="spinner" /> : mode === "login" ? "Log in 🌷" : "Create account 🌷"}
          </button>
        </form>

        <div className="switch">
          {mode === "login" ? (
            <>New here? <button onClick={() => { setMode("signup"); setError(""); }}>Make an account</button></>
          ) : (
            <>Already have one? <button onClick={() => { setMode("login"); setError(""); }}>Log in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
