import { describe, expect, it } from "vitest";

import { parseStockAdjustmentFormData } from "./stock-adjustment-form-data";

describe("parseStockAdjustmentFormData", () => {
  it("parses product id and quantity from form data", () => {
    const formData = new FormData();
    formData.set("productId", " product-1 ");
    formData.set("quantity", " 12 ");

    expect(parseStockAdjustmentFormData(formData)).toEqual({
      productId: "product-1",
      quantity: 12,
      type: "initial_adjustment",
    });
  });

  it("parses manual adjustment type", () => {
    const formData = new FormData();
    formData.set("productId", "product-1");
    formData.set("quantity", "-2");
    formData.set("type", "manual_adjustment");

    expect(parseStockAdjustmentFormData(formData)).toEqual({
      productId: "product-1",
      quantity: -2,
      type: "manual_adjustment",
    });
  });

  it("uses invalid numeric values for missing quantities", () => {
    const formData = new FormData();
    formData.set("productId", "product-1");

    expect(parseStockAdjustmentFormData(formData)).toEqual({
      productId: "product-1",
      quantity: Number.NaN,
      type: "initial_adjustment",
    });
  });
});
