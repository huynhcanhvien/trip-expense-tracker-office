/** Excel-friendly CSV: UTF-8 BOM, CRLF rows, and formula-looking cells neutralised. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? "" : String(value);
    // Stop spreadsheets from evaluating user text such as "=HYPERLINK(...)".
    if (/^[=+\-@\t\r]/.test(text) && typeof value !== "number")
      text = `'${text}`;
    return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
