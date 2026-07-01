import { useState } from "react";
import { api } from "../api.js";
import { Avatar, Modal, Select } from "./ui.jsx";
import { money, symbolOf, decimalsOf } from "../currencies.js";

const CATEGORIES = ["🍜", "🛒", "🏨", "🚕", "🎟️", "🛍️", "☕", "🧾"];

// Split a total equally across n people, exact to the currency's smallest unit.
function equalShares(total, n, decimals = 2) {
  const f = Math.pow(10, decimals);
  const units = Math.round(total * f);
  const base = Math.floor(units / n);
  const rem = units - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / f);
}

export default function AddExpenseModal({ trip, members, currency, ocrEnabled, currentUserId, expense, onClose, onSaved }) {
  const editing = Boolean(expense);

  // When editing, decide whether the saved split was an even share or custom.
  function detectMode() {
    if (!expense) return "equal";
    const dec = decimalsOf(currency);
    const f = Math.pow(10, dec);
    const r = (n) => Math.round(n * f) / f;
    const ids = expense.splits.map((s) => s.user_id);
    const even = equalShares(expense.amount, ids.length, dec).map(r).sort((a, b) => a - b);
    const actual = expense.splits.map((s) => r(s.amount)).sort((a, b) => a - b);
    return even.length === actual.length && even.every((v, i) => v === actual[i]) ? "equal" : "custom";
  }

  const [description, setDescription] = useState(expense?.description || "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category || "🧾");
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? currentUserId);
  const [receiptPath, setReceiptPath] = useState(expense?.receipt_path || null);

  const [splitMode, setSplitMode] = useState(detectMode);
  const [selected, setSelected] = useState(() =>
    expense ? new Set(expense.splits.map((s) => s.user_id)) : new Set(members.map((m) => m.id))
  );
  const [custom, setCustom] = useState(() =>
    expense ? Object.fromEntries(expense.splits.map((s) => [s.user_id, String(s.amount)])) : {}
  ); // userId -> string amount

  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const total = Number(amount) || 0;
  const decimals = decimalsOf(currency);
  const step = decimals > 0 ? "0.01" : "1";
  const factor = Math.pow(10, decimals);
  const round = (n) => Math.round((Number(n) || 0) * factor) / factor; // to currency's smallest unit
  const selectedIds = members.filter((m) => selected.has(m.id)).map((m) => m.id);

  // Live custom-split tallies, precise to the currency's smallest unit.
  const customAssigned = round(selectedIds.reduce((a, id) => a + (Number(custom[id]) || 0), 0));
  const customRemaining = round(total - customAssigned);

  // Equal-split exact shares (rounding remainder spread across the first people).
  const equalSharesArr =
    total > 0 && selectedIds.length ? equalShares(total, selectedIds.length, decimals) : [];
  const shareOf = (id) => {
    const i = selectedIds.indexOf(id);
    return i >= 0 && equalSharesArr.length ? equalSharesArr[i] : 0;
  };
  const equalEven =
    equalSharesArr.length ? equalSharesArr[0] === equalSharesArr[equalSharesArr.length - 1] : true;

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  // ---- receipt scanning ----
  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true); setScanNote(""); setErrors([]);
    try {
      const fd = new FormData();
      fd.append("receipt", file);
      const d = await api.upload("/scan-receipt", fd);
      setReceiptPath(d.receipt_path);
      if (d.scan?.ok) {
        if (d.scan.total > 0) setAmount(String(d.scan.total));
        if (d.scan.summary) setDescription(d.scan.summary);
        if (d.scan.category_emoji) setCategory(d.scan.category_emoji);
        setScanNote("✨ Read your receipt! Double-check the details below.");
      } else if (d.scan?.reason === "no_api_key") {
        setScanNote("📎 Photo attached. AI scanning is off, so just type the amount.");
      } else {
        setScanNote("📎 Photo attached, but I couldn't read it — please type the amount.");
      }
    } catch (err) {
      setErrors([err.message]);
    } finally {
      setScanning(false);
    }
  }

  async function save(e) {
    e.preventDefault();

    // Collect everything that's missing/wrong, then report it all at once.
    const errs = [];
    if (!description.trim()) errs.push("Add a description");
    if (!(total > 0)) errs.push("Enter an amount greater than 0");
    if (selectedIds.length === 0) {
      errs.push("Choose at least one person to split between");
    } else if (splitMode === "custom" && total > 0 && customRemaining !== 0) {
      errs.push(
        customRemaining > 0
          ? `Assign the remaining ${money(customRemaining, currency)} in the custom split`
          : `Custom split is ${money(-customRemaining, currency)} over the total`
      );
    }
    if (errs.length) return setErrors(errs);
    setErrors([]);

    let splits;
    if (splitMode === "equal") {
      const shares = equalShares(total, selectedIds.length, decimals);
      splits = selectedIds.map((id, i) => ({ user_id: id, amount: shares[i] }));
    } else {
      splits = selectedIds.map((id) => ({ user_id: id, amount: round(custom[id]) }));
    }

    const payload = {
      description, amount: total, category, paid_by: paidBy,
      receipt_path: receiptPath, splits,
    };

    setBusy(true);
    try {
      if (editing) await api.put(`/expenses/${expense.id}`, payload);
      else await api.post(`/trips/${trip.id}/expenses`, payload);
      onSaved();
    } catch (err) {
      setErrors([err.message]); setBusy(false);
    }
  }

  return (
    <Modal title={editing ? "Edit expense ✏️" : "Add expense 🧾"} onClose={onClose}>
      {errors.length > 0 && (
        <div className="error">
          {errors.length === 1 ? (
            errors[0]
          ) : (
            <>
              <strong>Please fix these before saving:</strong>
              <ul className="error-list">
                {errors.map((er, i) => <li key={i}>{er}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="field">
        <span>Snap a receipt {ocrEnabled ? "✨ auto-fills with AI" : ""}</span>
        <label className={"filedrop" + (scanning ? " busy" : "")}>
          <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={scanning} hidden />
          <span className="filedrop-icon">{scanning ? "⏳" : receiptPath ? "🖼️" : "📸"}</span>
          <span className="filedrop-text">
            {scanning ? "Reading your receipt…" : receiptPath ? "Photo added — tap to change" : "Take a photo or upload"}
          </span>
          {!scanning && !receiptPath && <span className="filedrop-hint">JPG or PNG, up to 12 MB</span>}
        </label>
      </div>
      {scanNote && <div className="notice">{scanNote}</div>}
      {receiptPath && <img src={receiptPath} alt="receipt" style={{ maxHeight: 120, borderRadius: 12, marginBottom: 12 }} />}

      <form onSubmit={save}>
        <label className="field">
          <span>What was it?</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter a description" />
        </label>

        <div className="row">
          <label className="field">
            <span>Amount ({symbolOf(currency)})</span>
            <input type="number" step={step} min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </label>
          <div className="field">
            <span>Paid by</span>
            <Select
              value={paidBy}
              onChange={setPaidBy}
              options={members.map((m) => ({ value: m.id, label: m.name }))}
            />
          </div>
        </div>

        <label className="field">
          <span>Category</span>
          <div className="emoji-pick">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
        </label>

        <div className="section-title">Split between</div>
        <div className="split-toggle">
          <button type="button" className={splitMode === "equal" ? "active" : ""} onClick={() => setSplitMode("equal")}>⚖️ Equally</button>
          <button type="button" className={splitMode === "custom" ? "active" : ""} onClick={() => setSplitMode("custom")}>✍️ Custom</button>
        </div>

        {members.map((m) => {
          const on = selected.has(m.id);
          return (
            <div className="split-member" key={m.id} style={{ opacity: on ? 1 : 0.45 }}>
              <input type="checkbox" checked={on} onChange={() => toggle(m.id)} style={{ width: 18, height: 18, flex: "0 0 auto" }} />
              <Avatar name={m.name} color={m.avatar_color} size="sm" />
              <span className="grow">{m.name}</span>
              {splitMode === "equal" ? (
                <span className="muted">{on ? money(shareOf(m.id), currency) : "—"}</span>
              ) : (
                <input
                  type="number" step={step} min="0" placeholder="0.00"
                  disabled={!on}
                  value={custom[m.id] ?? ""}
                  onChange={(e) => setCustom({ ...custom, [m.id]: e.target.value })}
                />
              )}
            </div>
          );
        })}

        {splitMode === "equal" && total > 0 && selectedIds.length > 0 && (
          <div className="split-summary ok">
            <span>Split {selectedIds.length} {selectedIds.length === 1 ? "way" : "ways"}</span>
            <span>
              {equalEven
                ? `${money(equalSharesArr[0] || 0, currency)} each`
                : `${money(equalSharesArr[equalSharesArr.length - 1], currency)}–${money(equalSharesArr[0], currency)} each`}
            </span>
          </div>
        )}

        {splitMode === "custom" && total > 0 && (
          <div className={"split-summary " + (customRemaining === 0 ? "ok" : "off")}>
            <span>Assigned {money(customAssigned, currency)} of {money(total, currency)}</span>
            <span>
              {customRemaining === 0
                ? "all set ✨"
                : customRemaining > 0
                  ? `${money(customRemaining, currency)} left`
                  : `${money(-customRemaining, currency)} over`}
            </span>
          </div>
        )}

        <button className="btn" style={{ width: "100%", marginTop: 16 }} disabled={busy || scanning}>
          {busy ? <span className="spinner" /> : editing ? "Save changes 🌸" : "Add expense 🌸"}
        </button>
      </form>
    </Modal>
  );
}
