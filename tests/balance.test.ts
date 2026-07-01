import { describe, it, expect } from "vitest";
import Big from "big.js";
import { computeBalances, type ExpenseInput } from "../src/lib/balance";

// Member ids used across the spec scenarios.
const ALICE = 1;
const BOB = 2;
const CAROL = 3;
const MEMBERS = [ALICE, BOB, CAROL];

function net(map: Map<number, Big>, id: number): string {
  return map.get(id)!.toString();
}

function sumAll(map: Map<number, Big>): Big {
  let s = new Big(0);
  for (const v of map.values()) s = s.plus(v);
  return s;
}

describe("computeBalances", () => {
  it("Scenario A: $60 dinner paid by Alice, split among all three → Alice +40, Bob -20, Carol -20", () => {
    const expenses: ExpenseInput[] = [
      { payerMemberId: ALICE, amount: new Big("60.00"), includedMemberIds: [ALICE, BOB, CAROL] },
    ];
    const balances = computeBalances(expenses, MEMBERS, 2);
    expect(net(balances, ALICE)).toBe("40");
    expect(net(balances, BOB)).toBe("-20");
    expect(net(balances, CAROL)).toBe("-20");
    expect(sumAll(balances).eq(0)).toBe(true);
  });

  it("Scenario G: $20 paid by Alice for Bob & Carol only (payer excluded) → Alice +20, Bob -10, Carol -10", () => {
    const expenses: ExpenseInput[] = [
      { payerMemberId: ALICE, amount: new Big("20.00"), includedMemberIds: [BOB, CAROL] },
    ];
    const balances = computeBalances(expenses, MEMBERS, 2);
    expect(net(balances, ALICE)).toBe("20");
    expect(net(balances, BOB)).toBe("-10");
    expect(net(balances, CAROL)).toBe("-10");
    expect(sumAll(balances).eq(0)).toBe(true);
  });

  it("combines Scenario A + G correctly", () => {
    const expenses: ExpenseInput[] = [
      { payerMemberId: ALICE, amount: new Big("60.00"), includedMemberIds: [ALICE, BOB, CAROL] },
      { payerMemberId: ALICE, amount: new Big("20.00"), includedMemberIds: [BOB, CAROL] },
    ];
    const balances = computeBalances(expenses, MEMBERS, 2);
    expect(net(balances, ALICE)).toBe("60"); // +40 +20
    expect(net(balances, BOB)).toBe("-30"); // -20 -10
    expect(net(balances, CAROL)).toBe("-30"); // -20 -10
    expect(sumAll(balances).eq(0)).toBe(true);
  });

  it("members with no activity show a zero balance", () => {
    const balances = computeBalances([], MEMBERS, 2);
    for (const id of MEMBERS) expect(net(balances, id)).toBe("0");
  });

  it("PROPERTY: net balances always sum to exactly Big(0), for a random trip", () => {
    for (let iter = 0; iter < 1000; iter++) {
      const dp = Math.random() < 0.5 ? 2 : 0;
      const memberCount = 2 + Math.floor(Math.random() * 8);
      const members = Array.from({ length: memberCount }, (_, i) => i + 1);

      const expenseCount = Math.floor(Math.random() * 12);
      const expenses: ExpenseInput[] = [];
      for (let e = 0; e < expenseCount; e++) {
        const minor = Math.floor(Math.random() * 10_000_000);
        const amount = new Big(minor).div(Big(10).pow(dp));
        const payer = members[Math.floor(Math.random() * members.length)];
        // A random non-empty included subset.
        const included = members.filter(() => Math.random() < 0.6);
        if (included.length === 0) included.push(members[0]);
        expenses.push({ payerMemberId: payer, amount, includedMemberIds: included });
      }

      const balances = computeBalances(expenses, members, dp);
      expect(sumAll(balances).eq(0)).toBe(true);
    }
  });
});
