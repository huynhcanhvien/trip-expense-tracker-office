import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  send: vi.fn(),
  vapid: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ adminSupabase: mocks.admin }));
vi.mock("web-push", () => ({
  default: { sendNotification: mocks.send, setVapidDetails: mocks.vapid },
}));

import {
  canRemind,
  deliverPendingPushes,
  pushPayload,
  type ClaimedPush,
} from "../src/lib/push";

const row = (n: number, expense: string | null = "e1"): ClaimedPush => ({
  id: `n${n}`,
  user_id: "u",
  title: "Nhắc: bạn còn khoản cần trả",
  expense_id: expense,
  group_id: "g1",
  endpoint: `https://push.example/${n}`,
  p256dh: "k",
  auth: "a",
  locale: "vi",
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:ops@example.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("web push", () => {
  it("builds a localized payload that links to the expense or group", () => {
    expect(JSON.parse(pushPayload(row(1), "en"))).toEqual({
      title: "Reminder: you still have a share to pay",
      url: "/expenses/e1",
      tag: "e1",
    });
    expect(JSON.parse(pushPayload(row(2, null))).url).toBe("/groups/g1");
  });

  it("does nothing without VAPID keys", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(await deliverPendingPushes()).toEqual({
      claimed: 0,
      sent: 0,
      removed: 0,
    });
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("sends claimed notifications and forgets expired subscriptions", async () => {
    const remove = vi
      .fn()
      .mockReturnValue({ in: vi.fn().mockResolvedValue({}) });
    mocks.admin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          row(1),
          row(2),
          { ...row(3), locale: "en" },
          // Claimed for a user without devices: counted, never sent.
          { ...row(4), endpoint: null, p256dh: null, auth: null },
        ],
        error: null,
      }),
      from: vi.fn().mockReturnValue({ delete: remove }),
    });
    mocks.send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 500 });
    expect(await deliverPendingPushes()).toEqual({
      claimed: 4,
      sent: 1,
      removed: 1,
    });
    expect(mocks.send).toHaveBeenCalledTimes(3);
    expect(JSON.parse(mocks.send.mock.calls[2][1]).title).toBe(
      "Reminder: you still have a share to pay",
    );
    expect(mocks.vapid).toHaveBeenCalledWith(
      "mailto:ops@example.test",
      "public",
      "private",
    );
    expect(remove.mock.results[0].value.in).toHaveBeenCalledWith("endpoint", [
      "https://push.example/2",
    ]);
  });
  it("allows a reminder again only after 20 hours", () => {
    const now = Date.parse("2026-10-21T12:00:00Z");
    expect(canRemind(null, now)).toBe(true);
    expect(canRemind("2026-10-21T00:00:00Z", now)).toBe(false);
    expect(canRemind("2026-10-20T16:00:00Z", now)).toBe(true);
  });
});
