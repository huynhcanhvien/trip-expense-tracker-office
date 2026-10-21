import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { deliverPendingPushes } from "@/lib/push";
import { apiFailure, ApiError, IMAGE_BUCKET } from "../../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;
const PUSH_BATCHES = 5;

/** Vercel Hobby runs cron once a day, so this one job also does all scheduled work. */
async function dailyJobs(admin: ReturnType<typeof adminSupabase>) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  const recurring = await admin.rpc("run_recurring", { p_today: today });
  const reminders = await admin.rpc("auto_remind_payments", {});
  return {
    recurring: recurring.error ? -1 : Number(recurring.data),
    reminders: reminders.error ? -1 : Number(reminders.data),
  };
}

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new ApiError("Cleanup is not configured.", 503);
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(request.headers.get("authorization") ?? "");
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new ApiError("Unauthorized", 401);
    const admin = adminSupabase();
    const daily = await dailyJobs(admin);
    const before = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: uploads, error } = await admin.rpc("claim_cleanup_uploads", {
      p_before: before,
      p_limit: 100,
    });
    if (error) throw new ApiError("Cleanup unavailable.", 503);
    let removed = 0;
    let failed = 0;
    for (const upload of uploads ?? []) {
      const paths = [upload.path, upload.preview_path].filter(
        (path): path is string => typeof path === "string",
      );
      const { error: removeError } = await admin.storage
        .from(IMAGE_BUCKET)
        .remove(paths);
      if (removeError) {
        failed++;
        continue;
      }
      const { error: deleteError } = await admin
        .from("uploads")
        .delete()
        .eq("id", upload.id)
        .eq("attached", false)
        .not("deleting_at", "is", null);
      if (deleteError) failed++;
      else removed++;
    }
    let pushed = 0;
    for (let i = 0; i < PUSH_BATCHES; i++) {
      const { claimed, sent } = await deliverPendingPushes();
      pushed += sent;
      if (!claimed) break;
    }
    const scheduledFailed = daily.recurring < 0 || daily.reminders < 0;
    return NextResponse.json(
      { removed, failed, ...daily, pushed },
      {
        status: failed || scheduledFailed ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
