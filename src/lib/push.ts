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
  endpoint: string;
  p256dh: string;
  auth: string;
};
const BATCH = 100;
const CONCURRENCY = 10;
const TTL_SECONDS = 24 * 60 * 60;

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
  sent: number;
  removed: number;
}> {
  const config = pushConfig();
  if (!config) return { sent: 0, removed: 0 };
  const admin = adminSupabase();
  const { data, error } = await admin.rpc("claim_push_notifications", {
    p_limit: BATCH,
  });
  if (error || !data?.length) return { sent: 0, removed: 0 };
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const rows = data as ClaimedPush[];
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
          pushPayload(row),
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
  return { sent, removed: gone.length };
}
