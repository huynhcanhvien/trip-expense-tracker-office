import { describe, expect, it } from "vitest";
import { weightedShares } from "../src/lib/split";

describe("weightedShares", () => {
  it("matches the database: round down, remainder to the last id", () => {
    expect(weightedShares("100000", { b: 2, a: 1, c: 3 }, 0)).toEqual({
      a: "16666",
      b: "33333",
      c: "50001",
    });
  });
  it("keeps cents for two-decimal currencies", () => {
    expect(weightedShares("10", { a: 1, b: 2 }, 2)).toEqual({
      a: "3.33",
      b: "6.67",
    });
  });
  it("returns nothing for empty, zero or invalid input", () => {
    expect(weightedShares("", { a: 1 }, 0)).toEqual({});
    expect(weightedShares("abc", { a: 1 }, 0)).toEqual({});
    expect(weightedShares("100", {}, 0)).toEqual({});
  });
});
