import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Avatar, Modal, Select, money } from "../components/ui.jsx";
import { CURRENCIES, DEFAULT_CURRENCY } from "../currencies.js";

const TRIP_EMOJIS = ["🌸", "🏖️", "⛰️", "🗼", "🏝️", "🎡", "🍜", "🚗", "✈️", "🏕️", "🎿", "🌴"];

export default function Trips() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const d = await api.get("/trips");
    setTrips(d.trips);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand"><span className="logo">🌸</span> Petal</div>
        <div className="who">
          <Avatar name={user.name} color={user.avatar_color} />
          <span>{user.name}</span>
          <span className="pill">demo mode</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Your trips</h1>
        <button className="btn" onClick={() => setShowNew(true)}>＋ New trip</button>
      </div>

      {loading ? (
        <div className="empty">Loading your adventures…</div>
      ) : trips.length === 0 ? (
        <div className="card empty">
          <span className="big">🧳</span>
          No trips yet! Create one and start splitting bills with friends.
        </div>
      ) : (
        <div className="trip-grid">
          {trips.map((t) => (
            <button key={t.id} className="trip-card" onClick={() => nav(`/trips/${t.id}`)}>
              <div className="emoji">{t.emoji}</div>
              <h3>{t.name}</h3>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {money(t.total, t.currency)} · {t.memberCount} {t.memberCount === 1 ? "person" : "people"}
              </div>
              <div className="trip-meta">
                <span className="pill">{t.emoji} trip</span>
                <BalanceTag value={t.yourBalance} symbol={t.currency} />
              </div>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <NewTripModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); nav(`/trips/${id}`); }}
        />
      )}
    </div>
  );
}

function BalanceTag({ value, symbol }) {
  if (Math.abs(value) < 0.01) return <span className="muted" style={{ fontSize: "0.8rem" }}>settled ✨</span>;
  return value > 0
    ? <span className="pos" style={{ fontSize: "0.85rem" }}>you're owed {money(value, symbol)}</span>
    : <span className="neg" style={{ fontSize: "0.85rem" }}>you owe {money(-value, symbol)}</span>;
}

function NewTripModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌸");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api.post("/trips", { name, emoji, currency });
      onCreated(d.id);
    } catch (err) {
      setError(err.message); setBusy(false);
    }
  }

  return (
    <Modal title="New trip 🌷" onClose={onClose}>
      {error && <div className="error">{error}</div>}
      <form onSubmit={create}>
        <label className="field">
          <span>Trip name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter a trip name" autoFocus />
        </label>
        <label className="field">
          <span>Pick an emoji</span>
          <div className="emoji-pick">
            {TRIP_EMOJIS.map((em) => (
              <button type="button" key={em} className={emoji === em ? "active" : ""} onClick={() => setEmoji(em)}>{em}</button>
            ))}
          </div>
        </label>
        <div className="field">
          <span>Currency</span>
          <Select
            searchable
            value={currency}
            onChange={setCurrency}
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name} (${c.symbol})` }))}
          />
        </div>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? <span className="spinner" /> : "Create trip"}
        </button>
      </form>
    </Modal>
  );
}
