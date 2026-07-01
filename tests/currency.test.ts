import { describe, it, expect } from "vitest";
import Big from "big.js";
import {
  share_of,
  decimalPlaces,
  formatAmount,
  formatSignedBalance,
  SUPPORTED_CURRENCIES,
} from "../src/lib/currency";

/** Return shares as [id, string] pairs sorted by id, for easy assertions. */
function sharesAsPairs(map: Map<number, Big>): [number, string][] {
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([id, v]) => [id, v.toString()]);
}

function sumShares(map: Map<number, Big>): Big {
  let s = new Big(0);
  for (const v of map.values()) s = s.plus(v);
  return s;
}

describe("decimalPlaces", () => {
  it("is 2 for USD/EUR/CNY and 0 for VND/JPY/KRW", () => {
    expect(decimalPlaces("USD")).toBe(2);
    expect(decimalPlaces("EUR")).toBe(2);
    expect(decimalPlaces("CNY")).toBe(2);
    expect(decimalPlaces("VND")).toBe(0);
    expect(decimalPlaces("JPY")).toBe(0);
    expect(decimalPlaces("KRW")).toBe(0);
  });
});

describe("share_of", () => {
  it("splits $10.00 among 3 → 3.33, 3.33, 3.34 (highest id absorbs remainder)", () => {
    const shares = share_of(new Big("10.00"), [7, 12, 19], 2);
    expect(sharesAsPairs(shares)).toEqual([
      [7, "3.33"],
      [12, "3.33"],
      [19, "3.34"],
    ]);
    expect(sumShares(shares).eq(new Big("10.00"))).toBe(true);
  });

  it("splits ¥500 among 3 → 166, 166, 168 (0 decimal places)", () => {
    const shares = share_of(new Big("500"), [1, 2, 3], 0);
    expect(sharesAsPairs(shares)).toEqual([
      [1, "166"],
      [2, "166"],
      [3, "168"],
    ]);
    expect(sumShares(shares).eq(new Big("500"))).toBe(true);
  });

  it("splits $0 among N → all zero", () => {
    const shares = share_of(new Big("0"), [4, 5, 6, 7], 2);
    for (const v of shares.values()) expect(v.eq(0)).toBe(true);
    expect(sumShares(shares).eq(0)).toBe(true);
  });

  it("splits $X among 1 → [$X]", () => {
    const shares = share_of(new Big("42.50"), [9], 2);
    expect(sharesAsPairs(shares)).toEqual([[9, "42.5"]]);
  });

  it("ignores input order (sorts ids ascending before allocating)", () => {
    const a = sharesAsPairs(share_of(new Big("10.00"), [19, 7, 12], 2));
    const b = sharesAsPairs(share_of(new Big("10.00"), [7, 12, 19], 2));
    expect(a).toEqual(b);
  });

  it("throws on an empty included set", () => {
    expect(() => share_of(new Big("10"), [], 2)).toThrow();
  });

  it("PROPERTY: shares always sum to the amount exactly, for random amount and N ≥ 1", () => {
    for (let iter = 0; iter < 2000; iter++) {
      const dp = Math.random() < 0.5 ? 2 : 0;
      // Build an exact decimal amount from integer minor units (no float error).
      const minor = Math.floor(Math.random() * 100_000_000);
      const amount = new Big(minor).div(Big(10).pow(dp));

      const n = 1 + Math.floor(Math.random() * 25);
      // Distinct random member ids.
      const ids = new Set<number>();
      while (ids.size < n) ids.add(1 + Math.floor(Math.random() * 10_000));

      const shares = share_of(amount, [...ids], dp);
      expect(shares.size).toBe(n);
      expect(sumShares(shares).eq(amount)).toBe(true);
    }
  });
});

describe("formatAmount", () => {
  it("formats each currency with the right decimals", () => {
    expect(formatAmount(new Big("12.34"), "USD")).toContain("12.34");
    // 0-decimal currencies show no fractional part.
    expect(formatAmount(new Big("500"), "JPY")).not.toContain(".");
    expect(formatAmount(new Big("500"), "VND")).not.toContain(".");
  });

  it("covers all supported currencies without throwing", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(typeof formatAmount(new Big("1000"), c)).toBe("string");
    }
  });
});

describe("formatSignedBalance", () => {
  it("prefixes + for amounts owed to the member", () => {
    expect(formatSignedBalance(new Big("40"), "USD")).toBe("+$40.00");
  });
  it("keeps the - for amounts the member owes", () => {
    expect(formatSignedBalance(new Big("-20"), "USD")).toBe("-$20.00");
  });
  it("shows a plain zero when settled", () => {
    expect(formatSignedBalance(new Big("0"), "USD")).toBe("$0.00");
  });
});
