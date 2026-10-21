import Big from "big.js";

/**
 * Mirrors save_expense's weighted split so the form previews exactly what the
 * database stores: each share rounds down, the last member by id takes the rest.
 */
export function weightedShares(
  amount: string,
  weights: Record<string, number>,
  decimals: number,
): Record<string, string> {
  const ids = Object.keys(weights).sort();
  const total = ids.reduce((sum, id) => sum + weights[id], 0);
  let value: Big;
  try {
    value = new Big(amount || 0);
  } catch {
    return {};
  }
  if (!ids.length || total <= 0 || value.lte(0)) return {};
  let remaining = value;
  return Object.fromEntries(
    ids.map((id, i) => {
      const share =
        i === ids.length - 1
          ? remaining
          : value.times(weights[id]).div(total).round(decimals, Big.roundDown);
      remaining = remaining.minus(share);
      return [id, share.toFixed(decimals)];
    }),
  );
}
