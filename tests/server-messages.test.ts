import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { localizeServerMessage } from "../src/i18n/server-messages";

function apiFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory()
      ? apiFiles(path)
      : entry.name.endsWith(".ts")
        ? [path]
        : [];
  });
}

describe("localizeServerMessage", () => {
  it("preserves Vietnamese, unknown messages and empty values", () => {
    expect(localizeServerMessage("Đã đổi tên nhóm.", "vi")).toBe(
      "Đã đổi tên nhóm.",
    );
    expect(localizeServerMessage("New upstream error", "en")).toBe(
      "New upstream error",
    );
    expect(localizeServerMessage("toString", "en")).toBe("toString");
    expect(localizeServerMessage(undefined, "en")).toBe("");
    expect(localizeServerMessage(null, "en")).toBe("");
  });
  it("translates successes and parametrized errors", () => {
    expect(localizeServerMessage("Đã lưu tài khoản ngân hàng.", "en")).toBe(
      "Bank account saved.",
    );
    for (const size of [5, 15]) {
      expect(
        localizeServerMessage(`Hãy chọn ảnh không quá ${size} MB.`, "en"),
      ).toBe(`Select an image no larger than ${size} MB.`);
      expect(
        localizeServerMessage(
          `Ảnh phải có dung lượng từ 1 byte đến ${size} MB.`,
          "en",
        ),
      ).toBe(`The image must be between 1 byte and ${size} MB.`);
      expect(localizeServerMessage(`Ảnh vượt quá ${size} MB.`, "en")).toBe(
        `The image exceeds ${size} MB.`,
      );
    }
    expect(
      localizeServerMessage(
        "Nhập số tiền với tối đa 2 chữ số thập phân; dùng dấu chấm, không dùng dấu phân cách hàng nghìn.",
        "en",
      ),
    ).toContain("at most 2 decimal places");
  });
  it.each([
    "src/lib/office-actions.ts",
    "src/app/auth/actions.ts",
    "src/lib/money-input.ts",
    ...apiFiles("src/app/api"),
    "src/lib/office-ocr.ts",
    "src/app/components/ImageUpload.tsx",
    "src/app/components/ReceiptScanner.tsx",
    "src/app/components/SavedImage.tsx",
  ])("covers the static server messages in %s", (file) => {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const messages: string[] = [];
    function visit(node: ts.Node) {
      if (
        ts.isStringLiteral(node) &&
        /[àáảãạăâđèéêìíòóôơùúưỳý]/i.test(node.text)
      )
        messages.push(node.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const message of messages)
      expect(localizeServerMessage(message, "en"), message).not.toBe(message);
  });
});
