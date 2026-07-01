"use client";

import { useState } from "react";
import ExpenseForm, { type MemberOption } from "./ExpenseForm";

interface Scan {
  receiptPath: string;
  amount: string | null;
  description: string | null;
  expenseDate: string | null;
}

type Status = "idle" | "scanning" | "unreadable" | "error" | "ready";

export default function AddFromPhoto({
  tripId,
  members,
  today,
}: {
  tripId: number;
  members: MemberOption[];
  today: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("scanning");
    setError("");

    const fd = new FormData();
    fd.append("receipt", file);
    fd.append("tripId", String(tripId));

    try {
      const res = await fetch("/api/expenses/from-photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setStatus("error");
        return;
      }
      if (!data.readable) {
        setStatus("unreadable");
        return;
      }
      setScan(data as Scan);
      setStatus("ready");
    } catch {
      setError("Upload failed");
      setStatus("error");
    }
  }

  if (status === "ready" && scan) {
    return (
      <div>
        <p className="muted">Review the details, choose who paid, and save.</p>
        <ExpenseForm
          tripId={tripId}
          members={members}
          today={today}
          prefill={{
            description: scan.description ?? "",
            amount: scan.amount ?? "",
            expenseDate: scan.expenseDate ?? today,
            photoPath: scan.receiptPath,
          }}
        />
      </div>
    );
  }

  return (
    <div className="photo-upload">
      <label>
        Scan a receipt photo
        <input type="file" accept="image/*" onChange={onFile} disabled={status === "scanning"} />
      </label>
      {status === "scanning" && <p className="muted">Reading receipt…</p>}
      {status === "unreadable" && (
        <p className="form-error">Couldn&apos;t read that image — please re-upload a clearer photo.</p>
      )}
      {status === "error" && <p className="form-error">{error}</p>}
    </div>
  );
}
