import { describe, expect, it } from "vitest";
import { toCsv } from "../src/lib/csv";

describe("toCsv", () => {
  it("adds a BOM, quotes special characters and uses CRLF", () => {
    expect(
      toCsv([
        ["Mô tả", "Số tiền"],
        ['Ăn "trưa", tối', 150000],
      ]),
    ).toBe('﻿Mô tả,Số tiền\r\n"Ăn ""trưa"", tối",150000\r\n');
  });
  it("neutralises spreadsheet formulas in text but keeps negative numbers", () => {
    expect(toCsv([["=1+1", "@cmd", "+x", -5, null]])).toBe(
      "﻿'=1+1,'@cmd,'+x,-5,\r\n",
    );
  });
});
