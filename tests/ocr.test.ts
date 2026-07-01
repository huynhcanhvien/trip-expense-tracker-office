import { describe, it, expect } from "vitest";
import { parseReceiptText } from "../src/lib/ocr";

const RECEIPT = `CAFE MAI
123 Main St
2026-07-01
Latte 4.50
Sandwich 8.00
Subtotal 12.50
Tax 1.00
TOTAL 13.50
`;

describe("parseReceiptText", () => {
  it("extracts amount (total, not subtotal), date, and merchant", () => {
    const r = parseReceiptText(RECEIPT);
    expect(r.readable).toBe(true);
    expect(r.amount).toBe("13.5"); // TOTAL 13.50, not Subtotal 12.50
    expect(r.expenseDate).toBe("2026-07-01");
    expect(r.description).toBe("CAFE MAI");
  });

  it("parses US-style dates to ISO", () => {
    const r = parseReceiptText("STORE\nDate: 07/04/2026\nTOTAL 9.99");
    expect(r.expenseDate).toBe("2026-07-04");
    expect(r.amount).toBe("9.99");
  });

  it("swaps day/month when the first field is clearly a day", () => {
    const r = parseReceiptText("SHOP\n25/12/2026\nTOTAL 5.00");
    expect(r.expenseDate).toBe("2026-12-25");
  });

  it("handles thousands separators in the total", () => {
    const r = parseReceiptText("HOTEL\nTOTAL 1,234.56");
    expect(r.amount).toBe("1234.56");
  });

  it("falls back to the largest decimal amount when there's no total line", () => {
    const r = parseReceiptText("KIOSK\nItem A 3.00\nItem B 12.75\nItem C 1.20");
    expect(r.amount).toBe("12.75");
  });

  it("marks blurry/empty output as unreadable (scenario C)", () => {
    expect(parseReceiptText("").readable).toBe(false);
    expect(parseReceiptText("   \n  \n").readable).toBe(false);
    expect(parseReceiptText("!@# %^&").readable).toBe(false);
  });
});
