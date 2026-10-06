"use client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { localizeServerMessage } from "@/i18n/server-messages";
import { useActionState, useState } from "react";
import { authenticate, googleSignIn } from "@/app/auth/actions";
import SubmitButton from "@/app/components/SubmitButton";

export default function AuthForm({
  next,
  initialError,
  message,
}: {
  next: string;
  initialError?: string;
  message?: string;
}) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  return (
    <>
      <div
        className="my-5 flex gap-2 rounded-xl bg-muted p-1"
        aria-label={t("account")}
      >
        <button
          type="button"
          className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-surface ${mode === "signin" ? "bg-surface text-primary shadow-soft" : ""}`}
          onClick={() => setMode("signin")}
        >
          {t("signIn")}
        </button>
        <button
          type="button"
          className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-surface ${mode === "signup" ? "active" : ""}`}
          onClick={() => setMode("signup")}
        >
          {t("signUp")}
        </button>
      </div>
      <CredentialsForm
        key={mode}
        mode={mode}
        next={next}
        initialError={initialError}
        message={mode === "signin" ? message : undefined}
      />
      <button
        type="button"
        className="min-h-11 flex-1 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-surface"
        onClick={() => setMode(mode === "forgot" ? "signin" : "forgot")}
      >
        {mode === "forgot" ? t("backToSignIn") : t("forgotYourPassword")}
      </button>
      {mode !== "forgot" && (
        <form
          action={googleSignIn}
          className="mt-5 flex min-w-0 flex-col gap-5"
        >
          <input type="hidden" name="next" value={next} />
          <SubmitButton
            label={t("continueWithGoogle")}
            pendingLabel={t("connecting")}
            className="self-start"
          />
        </form>
      )}
    </>
  );
}

function CredentialsForm({
  mode,
  next,
  initialError,
  message,
}: {
  mode: "signin" | "signup" | "forgot";
  next: string;
  initialError?: string;
  message?: string;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(authenticate, {});
  return (
    <form action={action} className="mt-5 flex min-w-0 flex-col gap-5">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      {mode === "signup" && (
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("displayName")}
          <input name="name" required maxLength={100} autoComplete="name" />
        </label>
      )}
      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
        Email
        <input type="email" name="email" required autoComplete="email" />
      </label>
      {mode !== "forgot" && (
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("password")}
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
          />
        </label>
      )}
      {(state.error || initialError) && (
        <p
          className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
          role="alert"
        >
          {localizeServerMessage(state.error || initialError, locale)}
        </p>
      )}
      {(state.message || message) && (
        <p
          className="rounded-xl bg-success-soft p-3 text-sm leading-6 text-success"
          role="status"
        >
          {localizeServerMessage(state.message || message, locale)}
        </p>
      )}
      <SubmitButton
        label={
          mode === "forgot"
            ? t("sendRecoveryLink")
            : mode === "signup"
              ? t("createAccount")
              : t("signIn")
        }
        pendingLabel={t("processing")}
        className="self-start"
      />
    </form>
  );
}
