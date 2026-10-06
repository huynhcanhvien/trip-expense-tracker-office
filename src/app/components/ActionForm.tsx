"use client";
import { useActionState, type ReactNode } from "react";
import SubmitButton from "./SubmitButton";
import { useLocale, useTranslations } from "next-intl";
import { localizeServerMessage } from "@/i18n/server-messages";
import type { OfficeState } from "@/lib/office-types";
export default function ActionForm({
  action,
  children,
  label,
  className = "mt-5 flex min-w-0 flex-col gap-5",
  submitDisabled = false,
}: {
  action: (state: OfficeState, form: FormData) => Promise<OfficeState>;
  children?: ReactNode;
  label?: string;
  className?: string;
  submitDisabled?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (submitDisabled) event.preventDefault();
      }}
    >
      {children}
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
        >
          {localizeServerMessage(state.error, locale)}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-xl bg-success-soft p-3 text-sm leading-6 text-success"
        >
          {localizeServerMessage(state.success, locale)}
        </p>
      )}
      <SubmitButton
        label={label || t("save")}
        pendingLabel={t("pending")}
        disabled={submitDisabled}
      />
    </form>
  );
}
