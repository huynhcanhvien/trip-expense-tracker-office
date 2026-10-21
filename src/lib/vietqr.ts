/**
 * VietQR (NAPAS) payloads follow EMVCo merchant-presented QR: a flat list of
 * `ID(2) LENGTH(2) VALUE` fields ending with a CRC16-CCITT checksum (tag 63).
 */
const NAPAS_GUID = "A000000727";
const ACCOUNT_SERVICE = "QRIBFTTA";
const VND_CODE = "704";
export const MAX_MEMO_LENGTH = 25;

export type VietQrAccount = {
  bin: string;
  accountNumber: string;
  holderName?: string;
  amount?: string;
  memo?: string;
};

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const field = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Returns null for anything that is not a well-formed TLV sequence. */
export function parseTlv(payload: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const length = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(length)) return null;
    const value = payload.slice(i + 4, i + 4 + length);
    if (value.length !== length) return null;
    fields.set(id, value);
    i += 4 + length;
  }
  return fields;
}

/** Bank-safe transfer memo: ASCII letters, digits and spaces only. */
export function sanitizeMemo(memo: string): string {
  return memo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MEMO_LENGTH)
    .trim();
}

export function parseVietQr(payload: string): VietQrAccount | null {
  const text = payload.trim();
  const crcAt = text.length - 8;
  if (crcAt < 0 || text.slice(crcAt, crcAt + 4) !== "6304") return null;
  if (crc16(text.slice(0, crcAt + 4)) !== text.slice(crcAt + 4).toUpperCase())
    return null;
  const fields = parseTlv(text);
  const merchant = fields && parseTlv(fields.get("38") || "");
  if (!fields || !merchant || merchant.get("00") !== NAPAS_GUID) return null;
  const beneficiary = parseTlv(merchant.get("01") || "");
  const bin = beneficiary?.get("00") || "";
  const accountNumber = beneficiary?.get("01") || "";
  if (!/^\d{6}$/.test(bin) || !accountNumber) return null;
  const extra = parseTlv(fields.get("62") || "");
  return {
    bin,
    accountNumber,
    holderName: fields.get("59") || undefined,
    amount: fields.get("54") || undefined,
    memo: extra?.get("08") || undefined,
  };
}

/** Dynamic VietQR that pre-fills the receiver, VND amount and memo in banking apps. */
export function buildVietQr(input: {
  bin: string;
  accountNumber: string;
  amount: string;
  memo: string;
}): string {
  if (!/^\d{6}$/.test(input.bin)) throw new Error("Invalid bank BIN");
  if (!/^[0-9A-Za-z]{1,19}$/.test(input.accountNumber))
    throw new Error("Invalid account number");
  if (!/^[1-9]\d{0,12}$/.test(input.amount))
    throw new Error("Invalid VND amount");
  const beneficiary = field("00", input.bin) + field("01", input.accountNumber);
  const memo = sanitizeMemo(input.memo);
  const body =
    field("00", "01") +
    field("01", "12") +
    field(
      "38",
      field("00", NAPAS_GUID) +
        field("01", beneficiary) +
        field("02", ACCOUNT_SERVICE),
    ) +
    field("53", VND_CODE) +
    field("54", input.amount) +
    field("58", "VN") +
    (memo ? field("62", field("08", memo)) : "") +
    "6304";
  return body + crc16(body);
}

/**
 * Payment QR for one member's share, or null when the payer has no VietQR bank
 * or the amount cannot be paid by VietQR (VietQR only carries whole VND).
 */
export function shareVietQr(input: {
  currency: string;
  bin: string | null | undefined;
  accountNumber: string;
  amount: string;
  memo: string;
}): string | null {
  if (input.currency !== "VND" || !input.bin) return null;
  const amount = input.amount.replace(/\.0+$/, "");
  try {
    return buildVietQr({
      bin: input.bin,
      accountNumber: input.accountNumber.replace(/\s+/g, ""),
      amount,
      memo: input.memo,
    });
  } catch {
    return null;
  }
}
