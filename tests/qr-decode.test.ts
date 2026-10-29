import { describe, expect, it } from "vitest";
import { crc16 } from "../src/lib/vietqr";
import { pickVietQr } from "../src/lib/qr-decode";

const body =
  "00020101021138570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN6304";
const vietQr = body + crc16(body);

describe("pickVietQr", () => {
  it("picks the bank VietQR among other codes in the same image", () => {
    expect(pickVietQr(["2|99|0901234567|NGUYEN VAN A", vietQr])).toEqual({
      status: "found",
      account: expect.objectContaining({
        bin: "970436",
        accountNumber: "0011001234567",
      }),
    });
  });
  it("tells codes that are not bank transfers apart from no code at all", () => {
    expect(pickVietQr(["https://example.com/pay"])).toEqual({
      status: "notVietQr",
    });
    expect(pickVietQr([])).toEqual({ status: "notFound" });
    expect(pickVietQr(["", "  "])).toEqual({ status: "notFound" });
  });
});
