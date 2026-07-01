import { useEffect, useRef, useState } from "react";

// Accent/diacritic-insensitive normalize so "dong" matches "Đồng".
function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

// Custom dropdown: the options panel always opens directly below the box.
// Pass searchable to show a type-to-filter box inside the panel.
export function Select({ value, onChange, options, placeholder = "Select…", searchable = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Reset + focus the search box each time the panel opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      if (searchable) setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  const q = norm(query.trim());
  const filtered = q
    ? options.filter((o) => norm(o.label).includes(q) || norm(o.value).includes(q))
    : options;

  function pick(v) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="select" ref={ref}>
      <button
        type="button"
        className={"select-display" + (open ? " open" : "")}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? "" : "muted"}>{selected ? selected.label : placeholder}</span>
        <span className="select-caret">▾</span>
      </button>
      {open && (
        <div className="select-panel">
          {searchable && (
            <input
              ref={searchRef}
              className="select-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length) { e.preventDefault(); pick(filtered[0].value); }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search…"
            />
          )}
          {filtered.length === 0 ? (
            <div className="select-empty">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className={"select-option" + (o.value === value ? " active" : "")}
                onClick={() => pick(o.value)}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function Avatar({ name, color, size }) {
  const cls = "avatar" + (size ? ` ${size}` : "");
  return (
    <span className={cls} style={{ background: color || "#f7a8c4" }} title={name}>
      {initials(name)}
    </span>
  );
}

export { money } from "../currencies.js";

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
