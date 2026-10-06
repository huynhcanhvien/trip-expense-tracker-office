"use client";

import { useActionState, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { deleteGroup } from "@/lib/office-actions";
import { localizeServerMessage } from "@/i18n/server-messages";
import SubmitButton from "./SubmitButton";
import { buttonVariants } from "./ui/button";

export default function DeleteGroupForm({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const t = useTranslations("deleteGroup");
  const locale = useLocale();
  const [state, action, pending] = useActionState(deleteGroup, {});
  const [confirmation, setConfirmation] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const matches = confirmation.trim() === groupName;
  return (
    <details
      ref={details}
      className="mt-5 min-w-0 rounded-2xl border border-danger/40 bg-surface p-5 shadow-soft sm:p-6"
    >
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-danger">
        {t("title")}
      </summary>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {t("warning")}
      </p>
      <p className="mt-3 wrap-anywhere text-sm font-semibold">{groupName}</p>
      <form
        action={action}
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          if (!matches || pending) event.preventDefault();
        }}
      >
        <input type="hidden" name="groupId" value={groupId} />
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("confirmationLabel")}
          <input
            name="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            disabled={pending}
            autoComplete="off"
          />
        </label>
        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
          >
            {localizeServerMessage(state.error, locale)}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <SubmitButton
            label={t("confirm")}
            pendingLabel={t("pending")}
            disabled={!matches || pending}
            className={buttonVariants({ variant: "destructive" })}
          />
          <button
            type="button"
            className={buttonVariants({ variant: "outline" })}
            disabled={pending}
            onClick={() => {
              setConfirmation("");
              if (details.current) details.current.open = false;
            }}
          >
            {t("cancel")}
          </button>
        </div>
      </form>
    </details>
  );
}
