"use client";

import type { ReactNode } from "react";

// A one-shot server-action form guarded by a native confirm() dialog: the
// hidden fields carry the ids the action needs, and submitting is cancelled if
// the user declines. Used for destructive actions (delete expense, close trip).
export default function ConfirmSubmitForm({
  action,
  message,
  fields,
  children,
  buttonClassName,
  title,
  ariaLabel,
}: {
  /** The server action to POST to. */
  action: (formData: FormData) => void | Promise<void>;
  /** Text shown in the confirm() dialog; submit is cancelled if declined. */
  message: string;
  /** Hidden inputs the action reads, e.g. { publicId, expenseId }. */
  fields: Record<string, string | number>;
  /** Contents of the submit button (label or icon). */
  children: ReactNode;
  buttonClassName?: string;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={buttonClassName} title={title} aria-label={ariaLabel}>
        {children}
      </button>
    </form>
  );
}
