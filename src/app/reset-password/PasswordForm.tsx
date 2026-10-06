"use client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { localizeServerMessage } from "@/i18n/server-messages";
import { useActionState } from "react";
import { changePassword } from "@/app/auth/actions";
import SubmitButton from "@/app/components/SubmitButton";

export default function PasswordForm() {
  const t = useTranslations("password");
  const locale = useLocale();
  const [state, action] = useActionState(changePassword, {});
  return (
    <form action={action} className="mt-5 flex min-w-0 flex-col gap-5">
      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
        {t("newPassword")}
        <input
          type="password"
          name="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
        {t("repeatPassword")}
        <input
          type="password"
          name="confirmation"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      {state.error && (
        <p
          className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
          role="alert"
        >
          {localizeServerMessage(state.error, locale)}
        </p>
      )}
      <SubmitButton
        label={t("changePassword")}
        pendingLabel={t("saving")}
        className="self-start"
      />
    </form>
  );
}
