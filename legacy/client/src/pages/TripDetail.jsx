import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Avatar, Modal, money } from "../components/ui.jsx";
import AddExpenseModal from "../components/AddExpenseModal.jsx";

export default function TripDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ocr, setOcr] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [showMember, setShowMember] = useState(false);
  const [viewImg, setViewImg] = useState(null);

  async function load() {
    try {
      const d = await api.get(`/trips/${id}`);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
    api.get("/ocr-status").then((d) => setOcr(d.enabled)).catch(() => {});
  }, [id]);

  if (error) return (
    <div className="app-shell">
      <button className="back-link" onClick={() => nav("/")}>← All trips</button>
      <div className="card error">{error}</div>
    </div>
  );
  if (!data) return <div className="app-shell"><div className="empty">Loading…</div></div>;

  const { trip, members, invites, expenses, balances, settlements, total } = data;
  const cur = trip.currency;
  const isOwner = trip.created_by === user.id;

  // Per-person breakdown: how much each person's share is, and how much they paid.
  const breakdown = members
    .map((m) => {
      const paid = expenses.filter((e) => e.paid_by === m.id).reduce((a, e) => a + e.amount, 0);
      const share = expenses.reduce(
        (a, e) => a + (e.splits.find((s) => s.user_id === m.id)?.amount || 0),
        0
      );
      return { ...m, paid, share, pct: total > 0 ? (share / total) * 100 : 0 };
    })
    .sort((a, b) => b.share - a.share);

  async function deleteExpense(eid) {
    if (!confirm("Delete this expense?")) return;
    await api.del(`/expenses/${eid}`);
    load();
  }
  async function deleteTrip() {
    if (!confirm(`Delete "${trip.name}" and all its expenses? This can't be undone.`)) return;
    await api.del(`/trips/${trip.id}`);
    nav("/");
  }

  return (
    <div className="app-shell">
      <button className="back-link" onClick={() => nav("/")}>← All trips</button>

      {/* Header */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: "2.6rem" }}>{trip.emoji}</span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0 }}>{trip.name}</h1>
          <div className="muted">Total spent · <b style={{ color: "var(--pink-600)" }}>{money(total, cur)}</b></div>
        </div>
        {isOwner && <button className="btn ghost tiny danger" onClick={deleteTrip}>Delete trip</button>}
      </div>

      {/* Members */}
      <div className="card">
        <div className="section-title">👯 Travelers
          <button className="btn ghost tiny" style={{ marginLeft: "auto" }} onClick={() => setShowMember(true)}>＋ Add person</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={m.name} color={m.avatar_color} />
              <span>{m.name}{m.id === user.id ? " (you)" : ""}</span>
            </div>
          ))}
        </div>
        {invites.length > 0 && (
          <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
            ⏳ Invited (will join when they sign up): {invites.join(", ")}
          </div>
        )}
      </div>

      {/* Balances + settlement */}
      <div className="card">
        <div className="section-title">💖 Who owes what</div>
        {balances.map((b) => (
          <div className="balance-row" key={b.id}>
            <Avatar name={b.name} color={b.avatar_color} size="sm" />
            <span className="grow">{b.name}</span>
            {Math.abs(b.balance) < 0.01
              ? <span className="muted">settled ✨</span>
              : b.balance > 0
                ? <span className="pos">+{money(b.balance, cur)}</span>
                : <span className="neg">−{money(-b.balance, cur)}</span>}
          </div>
        ))}

        <div className="section-title" style={{ marginTop: 18 }}>🪄 Settle up</div>
        {settlements.length === 0 ? (
          <div className="muted">Everyone's even — no payments needed! 🎉</div>
        ) : (
          settlements.map((s, i) => (
            <div className="settle" key={i}>
              <Avatar name={s.from.name} color={s.from.avatar_color} size="sm" />
              <span>{s.from.name}</span>
              <span className="arrow">→</span>
              <Avatar name={s.to.name} color={s.to.avatar_color} size="sm" />
              <span>{s.to.name}</span>
              <span style={{ marginLeft: "auto" }} className="pos">{money(s.amount, cur)}</span>
            </div>
          ))
        )}
      </div>

      {/* Per-person spending breakdown */}
      <div className="card">
        <div className="section-title">💸 Spending breakdown</div>
        {total === 0 ? (
          <div className="muted">No spending yet.</div>
        ) : (
          breakdown.map((m) => (
            <div className="breakdown-row" key={m.id}>
              <div className="breakdown-head">
                <Avatar name={m.name} color={m.avatar_color} size="sm" />
                <span className="grow">{m.name}{m.id === user.id ? " (you)" : ""}</span>
                <span className="breakdown-amt">{money(m.share, cur)} <span className="muted">· {Math.round(m.pct)}%</span></span>
              </div>
              <div className="bar"><div className="bar-fill" style={{ width: `${m.pct}%`, background: m.avatar_color }} /></div>
              <div className="breakdown-sub">paid {money(m.paid, cur)}</div>
            </div>
          ))
        )}
      </div>

      {/* Expenses */}
      <div className="card">
        <div className="section-title">🧾 Expenses
          <button className="btn tiny" style={{ marginLeft: "auto" }} onClick={() => setShowExpense(true)}>＋ Add expense</button>
        </div>
        {expenses.length === 0 ? (
          <div className="empty"><span className="big">🌸</span>No expenses yet — add the first one!</div>
        ) : (
          expenses.map((e) => (
            <div className="expense" key={e.id}>
              <div className="cat">{e.category}</div>
              <div className="grow">
                <div className="desc">{e.description}</div>
                <div className="sub">
                  {e.paid_by_name} paid · split {e.splits.length} {e.splits.length === 1 ? "way" : "ways"}
                </div>
              </div>
              {e.receipt_path && (
                <img className="thumb" src={e.receipt_path} alt="receipt" onClick={() => setViewImg(e.receipt_path)} />
              )}
              <div className="amt">{money(e.amount, cur)}</div>
              {(e.paid_by === user.id || isOwner) && (
                <>
                  <button className="modal-close" title="Edit" onClick={() => setEditExpense(e)}>✏️</button>
                  <button className="modal-close" title="Delete" onClick={() => deleteExpense(e.id)}>🗑️</button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {(showExpense || editExpense) && (
        <AddExpenseModal
          key={editExpense ? editExpense.id : "new"}
          trip={trip} members={members} currency={cur} ocrEnabled={ocr}
          currentUserId={user.id}
          expense={editExpense}
          onClose={() => { setShowExpense(false); setEditExpense(null); }}
          onSaved={() => { setShowExpense(false); setEditExpense(null); load(); }}
        />
      )}
      {showMember && (
        <AddMemberModal tripId={trip.id} onClose={() => setShowMember(false)} onReload={load} />
      )}
      {viewImg && (
        <div className="overlay" onMouseDown={() => setViewImg(null)}>
          <img src={viewImg} alt="receipt" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 16 }} />
        </div>
      )}
    </div>
  );
}

function AddMemberModal({ tripId, onClose, onReload }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter a name");
    setBusy(true); setError(""); setMsg("");
    try {
      await api.post(`/trips/${tripId}/members`, { name: name.trim() });
      setMsg(`✅ Added ${name.trim()}!`);
      setName("");
      onReload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a traveler 👯" onClose={onClose}>
      {error && <div className="error">{error}</div>}
      {msg && <div className="notice">{msg}</div>}
      <form onSubmit={add}>
        <label className="field">
          <span>Their name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter a name" autoFocus />
        </label>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? <span className="spinner" /> : "Add to trip"}
        </button>
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button type="button" className="btn ghost tiny" onClick={onClose}>Done</button>
        </div>
      </form>
    </Modal>
  );
}
