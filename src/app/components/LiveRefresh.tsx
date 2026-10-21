"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;
const STALE_AFTER_HIDDEN_MS = 30_000;

/**
 * Every state change (approval, transfer report, confirmation, cancellation,
 * reminder) notifies the affected members, so listening to the viewer's own new
 * notifications is enough to refresh the server-rendered page live. RLS limits
 * the stream to the viewer's rows. One socket per tab fits the free tier.
 */
export default function LiveRefresh({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt = 0;
    let stop = () => {};
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };
    // Catch up after the tab was asleep and may have missed events.
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_HIDDEN_MS)
        refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    let cancelled = false;
    import("@/lib/supabase/browser")
      .then(({ browserSupabase }) => {
        if (cancelled) return;
        const supabase = browserSupabase();
        const channel = supabase
          .channel(`inbox:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            refresh,
          )
          .subscribe();
        stop = () => void supabase.removeChannel(channel);
      })
      .catch(() => undefined); // Live updates are optional; the page still works.
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [router, userId]);
  return null;
}
