import { describe, it, expect } from "vitest";
import { normalizeReceiptFields } from "../src/lib/ocr";

describe("normalizeReceiptFields", () => {
  it("keeps a clean total, merchant, and ISO date", () => {
    const r = normalizeReceiptFields({
      readable: true,
      merchant: "RESTAURANT",
      amount: "131.78",
      date: "2026-07-01",
    });
    expect(r).toEqual({
      readable: true,
      amount: "131.78",
      description: "RESTAURANT",
      expenseDate: "2026-07-01",
    });
  });

  it("strips currency symbols and thousands separators from the amount", () => {
    expect(normalizeReceiptFields({ readable: true, merchant: null, amount: "$1,234.56", date: null }).amount).toBe(
      "1234.56",
    );
    expect(normalizeReceiptFields({ readable: true, merchant: null, amount: 42, date: null }).amount).toBe("42");
  });

  it("treats readable:false as unreadable", () => {
    expect(normalizeReceiptFields({ readable: false, merchant: "X", amount: "9.99", date: null }).readable).toBe(false);
  });

  it("treats a missing/invalid total as unreadable (can't build an expense)", () => {
    expect(normalizeReceiptFields({ readable: true, merchant: "X", amount: null, date: null }).readable).toBe(false);
    expect(normalizeReceiptFields({ readable: true, merchant: "X", amount: "0", date: null }).readable).toBe(false);
    expect(normalizeReceiptFields({ readable: true, merchant: "X", amount: "abc", date: null }).readable).toBe(false);
  });

  it("rejects a hallucinated / malformed date but keeps the rest", () => {
    const r = normalizeReceiptFields({ readable: true, merchant: "X", amount: "5.00", date: "last tuesday" });
    expect(r.readable).toBe(true);
    expect(r.amount).toBe("5");
    expect(r.expenseDate).toBeNull();
    expect(normalizeReceiptFields({ readable: true, merchant: "X", amount: "5.00", date: "2026-13-40" }).expenseDate).toBeNull();
  });

  it("nulls a blank merchant and caps long ones", () => {
    expect(normalizeReceiptFields({ readable: true, merchant: "   ", amount: "5.00", date: null }).description).toBeNull();
    const long = normalizeReceiptFields({ readable: true, merchant: "A".repeat(300), amount: "5.00", date: null });
    expect(long.description?.length).toBe(120);
  });
});
