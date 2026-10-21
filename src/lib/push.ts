import webpush from "web-push";
import { adminSupabase } from "@/lib/supabase/admin";
import { localizeServerMessage } from "@/i18n/server-messages";

/** Never import this module from a client component. */
export type ClaimedPush = {
  id: string;
  user_id: string;
  title: string;
  expense_id: string | null;
  group_id: string | null;
  /** Null when the user has no subscribed device; the row is still claimed. */
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  locale: string | null;
};
const BATCH = 100;
const CONCURRENCY = 10;
const TTL_SECONDS = 24 * 60 * 60;
const REMIND_COOLDOWN_MS = 20 * 60 * 60 * 1000;

/** Mirrors remind_payment's 20-hour limit so the button hides instead of failing. */
export function canRemind(
  lastRemindedAt: string | null | undefined,
  now = Date.now(),
) {
  return (
    !lastRemindedAt || now - Date.parse(lastRemindedAt) >= REMIND_COOLDOWN_MS
  );
}

export function pushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject
    ? { publicKey, privateKey, subject }
    : null;
}

/** Small JSON body the service worker turns into a system notification. */
export function pushPayload(row: ClaimedPush, locale = "vi"): string {
  return JSON.stringify({
    title: localizeServerMessage(row.title, locale),
    url: row.expense_id
      ? `/expenses/${row.expense_id}`
      : row.group_id
        ? `/groups/${row.group_id}`
        : "/notifications",
    tag: row.expense_id || row.id,
  });
}

/**
 * Sends notifications that have not been pushed yet. Safe to call from many
 * requests at once: the database hands each notification to one caller only.
 * Push is optional, so a missing configuration or delivery failure never throws.
 */
export async function deliverPendingPushes(): Promise<{
  claimed: number;
  sent: number;
  removed: number;
}> {
  const config = pushConfig();
  if (!config) return { claimed: 0, sent: 0, removed: 0 };
  const admin = adminSupabase();
  const { data, error } = await admin.rpc("claim_push_notifications", {
    p_limit: BATCH,
  });
  if (error || !data?.length) return { claimed: 0, sent: 0, removed: 0 };
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const claimed = new Set((data as ClaimedPush[]).map((row) => row.id)).size;
  const rows = (data as ClaimedPush[]).filter(
    (
      row,
    ): row is ClaimedPush & {
      endpoint: string;
      p256dh: string;
      auth: string;
    } => Boolean(row.endpoint && row.p256dh && row.auth),
  );
  const gone: string[] = [];
  let sent = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(
      rows.slice(i, i + CONCURRENCY).map((row) =>
        webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          pushPayload(row, row.locale || "vi"),
          { TTL: TTL_SECONDS, urgency: "normal" },
        ),
      ),
    );
    results.forEach((result, j) => {
      if (result.status === "fulfilled") return void sent++;
      const status = (result.reason as { statusCode?: number })?.statusCode;
      // 404/410: the browser unsubscribed; stop sending to it.
      if (status === 404 || status === 410) gone.push(rows[i + j].endpoint);
    });
  }
  if (gone.length)
    await admin.from("push_subscriptions").delete().in("endpoint", gone);
  return { claimed, sent, removed: gone.length };
}
