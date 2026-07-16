"use client";

import ConfirmSubmitForm from "@/app/components/ConfirmSubmitForm";
import { closeTripAction } from "@/app/trips/actions";

export default function CloseTripButton({
  publicId,
  unsettledCount,
}: {
  publicId: string;
  unsettledCount: number;
}) {
  const message =
    unsettledCount > 0
      ? `${unsettledCount} member${unsettledCount === 1 ? "" : "s"} still ` +
        `${unsettledCount === 1 ? "has" : "have"} an unsettled balance. ` +
        `Close anyway? This is permanent — a closed trip can't be reopened, and receipt photos are deleted.`
      : "Close this trip? This is permanent — it can't be reopened, and receipt photos are deleted.";

  return (
    <ConfirmSubmitForm
      action={closeTripAction}
      message={message}
      fields={{ publicId }}
      buttonClassName="link-danger"
    >
      Close trip
    </ConfirmSubmitForm>
  );
}
