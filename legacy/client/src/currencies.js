// Currency list + formatting. Each entry knows its symbol, decimal places,
// and where the symbol goes, so amounts render the local way.

export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", decimals: 2 },
  { code: "VND", name: "Vietnamese Đồng", symbol: "₫", flag: "🇻🇳", decimals: 0, after: true, group: "." },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵", decimals: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳", decimals: 2 },
  { code: "KRW", name: "Korean Won", symbol: "₩", flag: "🇰🇷", decimals: 0 },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭", decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬", decimals: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾", decimals: 2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩", decimals: 0, group: "." },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", flag: "🇵🇭", decimals: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳", decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦", decimals: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰", decimals: 2 },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$", flag: "🇹🇼", decimals: 0 },
];

export const DEFAULT_CURRENCY = "USD";

// Accepts a code ("VND") or a raw symbol ("$") for backward compatibility.
export function findCurrency(value) {
  if (!value) return null;
  return (
    CURRENCIES.find((c) => c.code === value) ||
    CURRENCIES.find((c) => c.symbol === value) ||
    null
  );
}

export function symbolOf(value) {
  const c = findCurrency(value);
  return c ? c.symbol : value || "$";
}

export function decimalsOf(value) {
  const c = findCurrency(value);
  return c ? c.decimals : 2;
}

export function money(amount, value) {
  const n = Number(amount) || 0;
  const c = findCurrency(value);
  if (!c) return `${value ?? "$"}${n.toFixed(2)}`; // unknown raw symbol

  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(c.decimals);
  let [int, frac] = fixed.split(".");
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, c.group || ","); // group thousands
  const num = frac ? `${int}${c.decimalSep || "."}${frac}` : int;
  const body = c.after ? `${num} ${c.symbol}` : `${c.symbol}${num}`;
  return neg ? `-${body}` : body;
}
