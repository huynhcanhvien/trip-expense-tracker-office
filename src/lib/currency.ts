// Currency helpers — plan §3.2, spec R6.
// Fixed supported list: USD/EUR/CNY (2dp), VND/JPY/KRW (0dp). Fixed per trip for its lifetime.
import Big from "big.js";

export type CurrencyCode = "USD" | "EUR" | "CNY" | "VND" | "JPY" | "KRW";

/** Decimal places, a display locale, and the flag of the country using each currency. */
export const CURRENCY_META: Record<CurrencyCode, { dp: number; locale: string; flag: string }> = {
  USD: { dp: 2, locale: "en-US", flag: "🇺🇸" },
  EUR: { dp: 2, locale: "en-IE", flag: "🇪🇺" },
  CNY: { dp: 2, locale: "zh-CN", flag: "🇨🇳" },
  VND: { dp: 0, locale: "vi-VN", flag: "🇻🇳" },
  JPY: { dp: 0, locale: "ja-JP", flag: "🇯🇵" },
  KRW: { dp: 0, locale: "ko-KR", flag: "🇰🇷" },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META) as CurrencyCode[];

/** Decimal places for a currency (USD/EUR/CNY → 2, VND/JPY/KRW → 0). */
export function decimalPlaces(currency: CurrencyCode): number {
  return CURRENCY_META[currency].dp;
}

/**
 * Split `amount` equally across the included members (plan §3.2).
 *
 * Sorts ids ascending; the first N-1 members each get the floor share
 * (rounded down to `dp` decimals) and the highest-id member absorbs the
 * remainder. Guarantees the shares sum to `amount` exactly, deterministically.
 */
export function share_of(amount: Big, includedMembers: number[], dp: number): Map<number, Big> {
  const ids = [...includedMembers].sort((a, b) => a - b);
  const n = ids.length;
  if (n === 0) throw new Error("share_of: included set must contain at least one member");

  const result = new Map<number, Big>();
  const per = amount.div(n).round(dp, Big.roundDown);

  let allocated = new Big(0);
  for (let i = 0; i < n - 1; i++) {
    result.set(ids[i], per);
    allocated = allocated.plus(per);
  }
  // Highest-id member absorbs the rounding remainder.
  result.set(ids[n - 1], amount.minus(allocated));

  return result;
}

/** Format an amount in the trip's currency, e.g. "$12.34", "¥500", "500 ₫". */
export function formatAmount(amount: Big, currency: CurrencyCode): string {
  const { locale } = CURRENCY_META[currency];
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    Number(amount.toString()),
  );
}

/**
 * Format a net balance with an explicit sign (spec R3): "+$X" = should receive,
 * "-$X" = should pay, "$0" = settled. (Intl already prefixes "-" for negatives.)
 */
export function formatSignedBalance(amount: Big, currency: CurrencyCode): string {
  if (amount.gt(0)) return `+${formatAmount(amount, currency)}`;
  return formatAmount(amount, currency);
}
