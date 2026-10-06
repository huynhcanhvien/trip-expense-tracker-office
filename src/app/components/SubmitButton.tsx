"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./ui/cn";
import { buttonVariants } from "./ui/button";

// A form submit button that disables itself and swaps its label while the
// surrounding form's action is pending. Reads the pending state from the
// enclosing <form> via useFormStatus, so callers don't thread it through
// (every form in the app repeated this same pattern).
export default function SubmitButton({
  label,
  pendingLabel,
  className,
  disabled = false,
}: {
  label: ReactNode;
  /** Shown while the form action is in flight, e.g. "Saving…". */
  pendingLabel: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cn(buttonVariants(), className)}
      aria-busy={pending}
      disabled={pending || disabled}
    >
      {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  );
}
