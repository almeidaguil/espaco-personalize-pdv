import { describe, expect, it } from "vitest";

import { createProductSchema } from "./product-validation";

describe("createProductSchema", () => {
  it("returns the canonical uppercase SKU", () => {
    expect(
      createProductSchema.parse({
        name: "Caneca personalizada",
        priceInReais: 35,
        sku: " rm-camisa-01 ",
      }).sku,
    ).toBe("RM-CAMISA-01");
  });

  it("returns undefined for an SKU containing only whitespace", () => {
    expect(
      createProductSchema.parse({
        name: "Caneca personalizada",
        priceInReais: 35,
        sku: "   ",
      }).sku,
    ).toBeUndefined();
  });

  it("rejects an SKU exceeding 64 characters after uppercase expansion", () => {
    const result = createProductSchema.safeParse({
      name: "Caneca personalizada",
      priceInReais: 35,
      sku: "ß".repeat(33),
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.sku).toEqual([
        "O SKU deve ter no maximo 64 caracteres.",
      ]);
    }
  });
});
