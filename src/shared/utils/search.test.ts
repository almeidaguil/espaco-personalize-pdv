import { describe, expect, it } from "vitest";

import { normalizeSearchTerm } from "./search";

describe("normalizeSearchTerm", () => {
  it("normalizes accents, spaces and letter casing", () => {
    expect(normalizeSearchTerm("  Caneca Personalizada  ")).toBe(
      "caneca personalizada",
    );
    expect(normalizeSearchTerm("CHÁVEIRO-001")).toBe("chaveiro-001");
  });

  it("keeps empty search terms empty", () => {
    expect(normalizeSearchTerm("   ")).toBe("");
  });
});
