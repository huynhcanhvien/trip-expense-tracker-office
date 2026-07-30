"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Avatar from "@/app/components/Avatar";
import Modal from "@/app/components/Modal";
import SubmitButton from "@/app/components/SubmitButton";
import FormError from "@/app/components/FormError";
import { addParticipantAction, type TripFormState } from "@/app/trips/actions";
import { getMe, setMe as persistMe, clearMe, rememberTrip, useMe } from "@/lib/recent-trips";

const initial: TripFormState = {};

export interface Person {
  id: number;
  displayName: string;
}

// The roster for a trip. Because there are no accounts, the browser remembers
// which participant is "you" (localStorage): we highlight that row, and the
// add-expense form defaults its payer to you. Also records the visit so the
// trip shows up in the home page's "recent trips".
export default function PeoplePanel({
  publicId,
  name,
  currency,
  members,
  open,
}: {
  publicId: string;
  name: string;
  currency: string;
  members: Person[];
  open: boolean;
}) {
  // "You" is browser-local (localStorage), read reactively so claim/switch below
  // re-render without local state.
  const me = useMe(publicId);
  // Open the picker on first mount if this browser hasn't claimed a participant
  // yet (initialized lazily so we never setState from the mount effect).
  const [picking, setPicking] = useState<boolean>(() => getMe(publicId) === null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Record the visit for the home page's recent-trips list.
  useEffect(() => {
    rememberTrip({ publicId, name, currency });
  }, [publicId, name, currency]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (picking && !d.open) d.showModal();
    if (!picking && d.open) d.close();
  }, [picking]);

  function claim(id: number) {
    persistMe(publicId, id);
    setPicking(false);
  }

  function switchIdentity() {
    clearMe(publicId);
    setPicking(true);
  }

  const meName = members.find((m) => m.id === me)?.displayName;

  return (
    <>
      <div className="section-title">👯 People ({members.length})</div>

      <p className="whoami muted">
        {meName ? (
          <>
            You&apos;re <strong>{meName}</strong> ·{" "}
            <button type="button" className="link-btn" onClick={switchIdentity}>
              Not you?
            </button>
          </>
        ) : (
          <button type="button" className="link-btn" onClick={() => setPicking(true)}>
            Which one are you?
          </button>
        )}
      </p>

      <div className="people-list">
        {members.map((m) => (
          <div className={m.id === me ? "people-row is-you" : "people-row"} key={m.id}>
            <Avatar name={m.displayName} size="sm" />
            <span className="grow">{m.displayName}</span>
            {m.id === me && <span className="member-role">you</span>}
          </div>
        ))}
        {members.length === 0 && <p className="muted">No one here yet — add people below.</p>}
      </div>

      {open && <AddPersonForm publicId={publicId} placeholder="Add a person" />}

      <Modal ref={dialogRef} title="Who are you?" onClose={() => setPicking(false)}>
        {/* Add yourself — creates your person and claims the "you" role. */}
        <p className="muted">Add yourself so we can highlight your balance and default who paid.</p>
        <AddPersonForm
          publicId={publicId}
          placeholder="Your name"
          cta="That's me"
          onAdded={claim}
        />

        {/* …or pick from anyone already on the trip. */}
        {members.length > 0 && (
          <>
            <p className="whoami muted">Already added? Pick yourself:</p>
            <div className="people-list">
              {members.map((m) => (
                <button key={m.id} type="button" className="pick-row" onClick={() => claim(m.id)}>
                  <Avatar name={m.displayName} size="sm" />
                  <span className="grow">{m.displayName}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <p className="auth-links">
          <button type="button" className="link-btn" onClick={() => setPicking(false)}>
            Not now
          </button>
        </p>
      </Modal>
    </>
  );
}

function AddPersonForm({
  publicId,
  placeholder,
  cta = "Add",
  onAdded,
}: {
  publicId: string;
  placeholder: string;
  cta?: string;
  onAdded?: (memberId: number) => void;
}) {
  const [state, action] = useActionState(addParticipantAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<number | null>(null);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    // Fire onAdded once per created member (e.g. to claim "you").
    if (onAdded && state.memberId != null && handled.current !== state.memberId) {
      handled.current = state.memberId;
      onAdded(state.memberId);
    }
  }, [state, onAdded]);

  return (
    <form ref={formRef} action={action} className="ghost-form">
      <input type="hidden" name="publicId" value={publicId} />
      <input type="text" name="name" required maxLength={80} placeholder={placeholder} />
      <SubmitButton label={cta} pendingLabel="Adding…" />
      <FormError message={state.error} />
    </form>
  );
}
