"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setPushSubscription } from "@/lib/office-actions";
import { localizeServerMessage } from "@/i18n/server-messages";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
type State = "loading" | "unsupported" | "blocked" | "off" | "on";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** Opt-in browser notifications; renders nothing when push is not configured. */
export default function PushToggle() {
  const t = useTranslations("push");
  const locale = useLocale();
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    async function detect(): Promise<State> {
      if (!supported()) return "unsupported";
      if (Notification.permission === "denied") return "blocked";
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return "off";
      // Re-bind this device to whoever is signed in now (shared devices).
      const json = sub.toJSON();
      const result = await setPushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        locale,
        enabled: true,
      });
      return result.error ? "off" : "on";
    }
    detect()
      .catch((): State => "off")
      .then((next) => alive && setState(next));
    return () => {
      alive = false;
    };
  }, [locale]);
  if (!PUBLIC_KEY) return null;

  async function enable() {
    setError("");
    setState("loading");
    try {
      if ((await Notification.requestPermission()) !== "granted")
        return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(PUBLIC_KEY),
        }));
      const json = sub.toJSON();
      const result = await setPushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        locale,
        enabled: true,
      });
      if (result.error) {
        await sub.unsubscribe();
        throw new Error(result.error);
      }
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
      setState("off");
    }
  }
  async function disable() {
    setError("");
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await setPushSubscription({ endpoint: sub.endpoint, enabled: false });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError(t("failed"));
      setState("on");
    }
  }
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm leading-7 text-muted-foreground">
        {state === "unsupported"
          ? t("unsupported")
          : state === "blocked"
            ? t("blocked")
            : state === "on"
              ? t("on")
              : t("off")}
      </p>
      {(state === "on" || state === "off" || state === "loading") && (
        <button
          type="button"
          disabled={state === "loading"}
          aria-pressed={state === "on"}
          onClick={() => void (state === "on" ? disable() : enable())}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-surface-raised px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
        >
          {state === "on" ? t("disable") : t("enable")}
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
        >
          {localizeServerMessage(error, locale)}
        </p>
      )}
    </div>
  );
}
