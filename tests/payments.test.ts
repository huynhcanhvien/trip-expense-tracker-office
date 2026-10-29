import { describe, expect, it } from "vitest";
import { AUTO_CONFIRM_HOURS, autoConfirmAt } from "../src/lib/payments";

describe("autoConfirmAt", () => {
  it("is the report time plus the auto-confirm window", () => {
    expect(AUTO_CONFIRM_HOURS).toBe(48);
    expect(autoConfirmAt("2026-10-29T10:00:00.000Z").toISOString()).toBe(
      "2026-10-31T10:00:00.000Z",
    );
  });
});
