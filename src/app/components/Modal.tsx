"use client";

import { forwardRef, useRef, type ReactNode } from "react";

// Shared dialog shell used by every modal in the app (new trip, add expense,
// "who are you?"). Centralizes the boilerplate each one repeated: the `modal`
// surface, click-outside-to-close, the titled header, and the corner close
// button that must render last so the dialog auto-focuses the first field.
//
// Opening/closing stays with the caller via the forwarded ref (showModal/close)
// or the native `close` event — this component is purely presentational.
const Modal = forwardRef<HTMLDialogElement, ModalProps>(function Modal(
  { title, children, id, className, onClose },
  forwardedRef,
) {
  const innerRef = useRef<HTMLDialogElement>(null);

  // Keep our own ref (for backdrop/close-button handling) while still honoring
  // whatever ref the caller passed.
  const setRefs = (el: HTMLDialogElement | null) => {
    innerRef.current = el;
    if (typeof forwardedRef === "function") forwardedRef(el);
    else if (forwardedRef) forwardedRef.current = el;
  };

  return (
    <dialog
      id={id}
      ref={setRefs}
      className={className ? `modal ${className}` : "modal"}
      onClick={(e) => {
        // Clicks on the backdrop land on the <dialog> element itself.
        if (e.target === innerRef.current) innerRef.current?.close();
      }}
      onClose={onClose}
    >
      <div className="modal-head">
        <h2>{title}</h2>
      </div>

      {children}

      {/* Last in the DOM so the dialog auto-focuses the first field, not this. */}
      <button
        type="button"
        className="modal-close"
        aria-label="Close"
        onClick={() => innerRef.current?.close()}
      >
        ×
      </button>
    </dialog>
  );
});

export interface ModalProps {
  /** Heading shown in the dialog header. */
  title: ReactNode;
  children: ReactNode;
  /** Optional DOM id, for openers that reach the dialog via getElementById. */
  id?: string;
  /** Extra class(es) appended to the base `modal` class, e.g. "modal-wide". */
  className?: string;
  /** Fires on any close (Esc, backdrop, or close button) — sync caller state here. */
  onClose?: () => void;
}

export default Modal;
