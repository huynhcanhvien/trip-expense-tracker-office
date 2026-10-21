import { describe, it, expect } from "vitest";
import { calculateStats } from "../src/lib/office-stats";
import type { Group, Expense, Share } from "../src/lib/office-types";
const group = (id: string, currency: string) =>
  ({
    id,
    currency,
    name: id,
    owner_id: "a",
    invite_token: "t",
    created_at: "",
  }) as Group;
const expense = (
  id: string,
  group_id = "g",
  status: Expense["status"] = "active",
  amount = "100",
) =>
  ({
    id,
    group_id,
    status,
    amount,
    creator_id: "a",
    payer_id: "a",
    description: id,
    expense_date: "2026-10-05",
    receipt_upload_id: null,
    cancel_reason: null,
    reject_reason: null,
    approved_at: null,
    has_reported: false,
    created_at: "",
  }) as Expense;
const share = (
  expense_id: string,
  user_id: string,
  amount: string,
  payment_status: Share["payment_status"],
) => ({ expense_id, user_id, amount, payment_status });
describe("office statistics", () => {
  it("groups daily and monthly totals exactly, sorts dates and excludes cancelled expenses", () => {
    const [s] = calculateStats(
      [group("g", "USD")],
      [
        {
          ...expense("first", "g", "active", "0.1"),
          expense_date: "2026-10-06",
        },
        {
          ...expense("second", "g", "completed", "0.2"),
          expense_date: "2026-10-06",
        },
        {
          ...expense("earlier", "g", "active", "2"),
          expense_date: "2026-09-30",
        },
        {
          ...expense("sameMonth", "g", "active", "0.05"),
          expense_date: "2026-10-01",
        },
        {
          ...expense("cancelled", "g", "cancelled", "999"),
          expense_date: "2026-10-06",
        },
      ],
      [],
      "a",
    );
    expect(s.days).toEqual([
      { day: "2026-09-30", amount: "2" },
      { day: "2026-10-01", amount: "0.05" },
      { day: "2026-10-06", amount: "0.3" },
    ]);
    expect(s.months).toEqual([
      { month: "2026-09", amount: "2" },
      { month: "2026-10", amount: "0.35" },
    ]);
  });
  it("keeps reported money outstanding and excludes own share from collection", () => {
    const [s] = calculateStats(
      [group("g", "VND")],
      [expense("e")],
      [
        share("e", "a", "40", "self"),
        share("e", "b", "30", "reported"),
        share("e", "c", "30", "confirmed"),
      ],
      "a",
    );
    expect(s.totals).toMatchObject({
      spent: "100",
      toCollect: "60",
      received: "30",
      reported: "30",
      outstanding: "30",
      advanced: "100",
      personalShare: "40",
      toReceive: "30",
      toPay: "0",
    });
  });
  it("excludes cancellations from spending and preserves confirmed reconciliation", () => {
    const [s] = calculateStats(
      [group("g", "VND")],
      [expense("e", "g", "cancelled")],
      [share("e", "b", "60", "confirmed")],
      "a",
    );
    expect(s.totals.spent).toBe("0");
    expect(s.totals.received).toBe("0");
    expect(s.totals.cancelledReceived).toBe("60");
    expect(s.months).toEqual([]);
  });
  it("never nets payable against receivable", () => {
    const e2 = { ...expense("f"), creator_id: "b", payer_id: "b" };
    const [s] = calculateStats(
      [group("g", "VND")],
      [expense("e"), e2],
      [share("e", "b", "50", "pending"), share("f", "a", "50", "pending")],
      "a",
    );
    expect(s.totals.toPay).toBe("50");
    expect(s.totals.toReceive).toBe("50");
  });
  it("separates currencies and adds decimal amounts exactly", () => {
    const s = calculateStats(
      [group("g", "USD"), group("h", "VND")],
      [
        expense("e", "g", "active", "0.1"),
        expense("f", "g", "completed", "0.2"),
        expense("v", "h", "active", "10"),
      ],
      [],
      "a",
    );
    expect(s.find((x) => x.currency === "USD")?.totals.spent).toBe("0.3");
    expect(s.find((x) => x.currency === "VND")?.totals.spent).toBe("10");
    expect(s.find((x) => x.currency === "USD")?.totals.completed).toBe(1);
  });
  it("credits the payer, not the creator, and ignores unapproved expenses", () => {
    const paidByB = { ...expense("e"), creator_id: "a", payer_id: "b" };
    const awaiting = { ...expense("w", "g", "awaiting_payer"), payer_id: "b" };
    const rejected = { ...expense("r", "g", "rejected"), payer_id: "b" };
    const [s] = calculateStats(
      [group("g", "VND")],
      [paidByB, awaiting, rejected],
      [
        share("e", "a", "60", "pending"),
        share("e", "b", "40", "self"),
        share("w", "a", "100", "pending"),
        share("r", "a", "100", "pending"),
      ],
      "a",
    );
    expect(s.totals.spent).toBe("100");
    expect(s.totals.advanced).toBe("0");
    expect(s.totals.toPay).toBe("60");
    expect(s.totals.toReceive).toBe("0");
    const b = s.people.find((p) => p.userId === "b");
    expect(b?.advanced).toBe("100");
    expect(b?.toReceive).toBe("60");
  });
  it("totals approved spending per category, largest first", () => {
    const [s] = calculateStats(
      [group("g", "VND")],
      [
        { ...expense("a", "g", "active", "100"), category: "food" },
        { ...expense("b", "g", "completed", "300"), category: "transport" },
        { ...expense("c", "g", "active", "50"), category: "food" },
        { ...expense("d", "g", "cancelled", "999"), category: "gift" },
        { ...expense("w", "g", "awaiting_payer", "999"), category: "gift" },
        expense("x", "g", "active", "150"),
      ],
      [],
      "a",
    );
    expect(s.categories).toEqual([
      { category: "transport", amount: "300", count: 1 },
      { category: "food", amount: "150", count: 2 },
      { category: "other", amount: "150", count: 1 },
    ]);
  });
});
