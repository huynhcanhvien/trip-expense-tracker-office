import { describe, expect, it } from "vitest";
import vi from "../messages/vi.json";
import en from "../messages/en.json";
import { isLocale, resolveLocale } from "../src/i18n/config";
function keys(value: object, prefix = ""): string[] {
  return Object.entries(value)
    .flatMap(([key, entry]) =>
      typeof entry === "object"
        ? keys(entry, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    )
    .sort();
}
describe("locale configuration", () => {
  it("defaults to Vietnamese unless explicitly set to English", () => {
    for (const value of [undefined, "", "en-US", "fr", "EN", "vi"])
      expect(resolveLocale(value)).toBe("vi");
    expect(resolveLocale("en")).toBe("en");
    expect(isLocale(null)).toBe(false);
    expect(isLocale("en")).toBe(true);
  });
  it("keeps both message catalogs complete", () => {
    expect(keys(en)).toEqual(keys(vi));
  });
});

function messages(value: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "object"
        ? Object.entries(messages(entry, `${prefix}${key}.`))
        : [[`${prefix}${key}`, entry]],
    ),
  );
}
it("keeps ICU parameters consistent in both languages", () => {
  const vietnamese = messages(vi),
    english = messages(en);
  const params = (text: string) =>
    [
      ...new Set([...text.matchAll(/\{([a-zA-Z0-9_]+)[},]/g)].map((m) => m[1])),
    ].sort();
  for (const [key, text] of Object.entries(vietnamese))
    expect(params(english[key]), key).toEqual(params(text));
});
