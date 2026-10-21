import { describe, expect, it } from "vitest";
import {
  buildVietQr,
  crc16,
  parseVietQr,
  sanitizeMemo,
  shareVietQr,
} from "../src/lib/vietqr";
import { bankByBin, bankByName } from "../src/lib/vietqr-banks";

describe("VietQR", () => {
  it("computes CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("builds a payload that round-trips through the parser", () => {
    const payload = buildVietQr({
      bin: "970436",
      accountNumber: "0011001234567",
      amount: "150000",
      memo: "Ăn trưa đội 5",
    });
    expect(payload.startsWith("000201010212")).toBe(true);
    expect(payload).toContain("5303704");
    expect(payload).toContain("5406150000");
    expect(payload).toContain("5802VN");
    expect(parseVietQr(payload)).toEqual({
      bin: "970436",
      accountNumber: "0011001234567",
      amount: "150000",
      memo: "An trua doi 5",
      holderName: undefined,
    });
  });

  it("parses a static QR with a holder name and lowercase checksum", () => {
    const body =
      "00020101021138540010A00000072701240006970422011003123456780208QRIBFTTA53037045802VN5912NGUYEN VAN A6304";
    const payload = body + crc16(body).toLowerCase();
    expect(parseVietQr(` ${payload}\n`)).toMatchObject({
      bin: "970422",
      accountNumber: "0312345678",
      holderName: "NGUYEN VAN A",
    });
  });

  it("rejects a bad checksum, non-NAPAS QR and malformed data", () => {
    const payload = buildVietQr({
      bin: "970436",
      accountNumber: "123",
      amount: "1",
      memo: "",
    });
    expect(parseVietQr(payload.slice(0, -1) + "0")).toBeNull();
    expect(parseVietQr("https://example.com")).toBeNull();
    const body = "000201010211261800140000000000000053037046304";
    expect(parseVietQr(body + crc16(body))).toBeNull();
    const broken = "0002016304";
    expect(parseVietQr(broken.slice(0, -4) + crc16(broken))).toBeNull();
  });

  it("only accepts whole VND amounts and valid accounts", () => {
    const base = { bin: "970436", accountNumber: "123", memo: "x" };
    expect(() => buildVietQr({ ...base, amount: "10.5" })).toThrow(/amount/);
    expect(() => buildVietQr({ ...base, amount: "0" })).toThrow(/amount/);
    expect(() => buildVietQr({ ...base, bin: "12", amount: "10" })).toThrow(
      /BIN/,
    );
    expect(() =>
      buildVietQr({ ...base, accountNumber: "12 3", amount: "10" }),
    ).toThrow(/account/);
  });

  it("sanitizes memos to bank-safe ASCII within 25 characters", () => {
    expect(sanitizeMemo("Đi chơi — Đà Lạt #3!")).toBe("Di choi Da Lat 3");
    expect(sanitizeMemo("x".repeat(40))).toHaveLength(25);
    expect(sanitizeMemo("  ✨  ")).toBe("");
  });

  it("looks banks up by BIN and short name", () => {
    expect(bankByBin("970436")?.shortName).toBe("Vietcombank");
    expect(bankByBin(null)).toBeUndefined();
    expect(bankByName(" mb  bank ")?.bin).toBe("970422");
    expect(bankByName("")).toBeUndefined();
  });
});

describe("shareVietQr", () => {
  const base = {
    currency: "VND",
    bin: "970436",
    accountNumber: "0011 0012 34",
    amount: "50000.00",
    memo: "Lan Ăn trưa",
  };
  it("builds a QR for a whole VND share and strips account spacing", () => {
    expect(parseVietQr(shareVietQr(base) || "")).toMatchObject({
      accountNumber: "0011001234",
      amount: "50000",
      memo: "Lan An trua",
    });
  });
  it("returns null without a BIN, outside VND or for a zero share", () => {
    expect(shareVietQr({ ...base, bin: null })).toBeNull();
    expect(shareVietQr({ ...base, currency: "USD" })).toBeNull();
    expect(shareVietQr({ ...base, amount: "0" })).toBeNull();
  });
});
