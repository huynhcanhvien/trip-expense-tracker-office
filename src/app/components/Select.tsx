import type { SelectHTMLAttributes, ReactNode } from "react";

// A native <select> wrapped so we can draw our own chevron: the browser's
// default arrow is inconsistent across platforms and clashes with the soft
// pastel look, so we hide it (appearance: none) and render a tidy caret via
// the .select wrapper's ::after. All props pass straight through to the
// <select>, so it still works with form actions (name/defaultValue/required).
export default function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <span className="select">
      <select {...props}>{children}</select>
    </span>
  );
}
