"use client";

import { useState } from "react";

// Copies the shareable trip link to the clipboard and shows a brief toast.
// Anyone with this link can open and edit the trip — no account needed.
export default function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard may be blocked (e.g. insecure context) — the link stays
      // visible below so it can be copied manually.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="share">
      <input className="share-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <div className="share-actions">
        <button type="button" onClick={copy}>
          Copy trip link
        </button>
        {copied && (
          <span role="status" className="toast">
            Link copied!
          </span>
        )}
      </div>
    </div>
  );
}
