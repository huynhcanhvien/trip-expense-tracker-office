// Net-balance computation — plan §3.1, spec R3 + scenarios A, G.
// Net per member only (paid − consumed). No "who pays whom" suggestions (out of scope).
//
// Pure function of the raw expense data — balances are computed on demand,
// never cached, so edits/deletes (R5) can't leave stale state.
import Big from "big.js";
import { share_of } from "./currency";

export interface ExpenseInput {
  /** TripMember id of who paid. */
  payerMemberId: number;
  /** Total amount of the expense. */
  amount: Big;
  /** TripMember ids the expense is split equally among (the "included" set). */
  includedMemberIds: number[];
  /**
   * Custom split: exact amount owed per member (memberId → amount). When set,
   * these are used verbatim instead of an equal split. The amounts sum to
   * `amount` (enforced when the expense is saved).
   */
  customShares?: Map<number, Big>;
}

/**
 * Compute net balance per member: `paid − consumed`.
 *  - `net > 0` → should receive
 *  - `net < 0` → should pay
 *  - `net = 0` → settled
 *
 * The sum of all net balances is always exactly `Big(0)` (see property test):
 * each expense credits the payer `amount` and debits the included set shares
 * that sum to `amount`.
 *
 * @param memberIds all trip members, so everyone appears even with no activity.
 * @param dp decimal places for the trip's currency (drives equal-split rounding).
 */
export function computeBalances(
  expenses: ExpenseInput[],
  memberIds: number[],
  dp: number,
): Map<number, Big> {
  const net = new Map<number, Big>();
  for (const id of memberIds) net.set(id, new Big(0));

  const add = (id: number, delta: Big) => {
    net.set(id, (net.get(id) ?? new Big(0)).plus(delta));
  };

  for (const e of expenses) {
    // Payer is credited the full amount they paid...
    add(e.payerMemberId, e.amount);
    // ...and each included member is debited their share: exact amounts for a
    // custom split, otherwise an equal share of the total.
    const shares = e.customShares ?? share_of(e.amount, e.includedMemberIds, dp);
    for (const [memberId, shareValue] of shares) {
      add(memberId, shareValue.times(-1));
    }
  }

  return net;
}
