import { describe, expect, it } from "vitest";

import { parseCreateProductFormData } from "./product-form-data";

describe("parseCreateProductFormData", () => {
  it("normalizes product form entries for the create product use case", () => {
    const formData = new FormData();
    formData.set("name", " Caneca personalizada ");
    formData.set("priceInReais", "R$ 35,99");
    formData.set("sku", " CANECA-001 ");
    formData.set("isActive", "true");

    expect(parseCreateProductFormData(formData)).toEqual({
      isActive: true,
      name: "Caneca personalizada",
      priceInReais: 35.99,
      sku: "CANECA-001",
    });
  });

  it("defaults product activity to true and normalizes empty SKU to null", () => {
    const formData = new FormData();
    formData.set("name", "Caneca personalizada");
    formData.set("priceInReais", "35,00");
    formData.set("sku", " ");

    expect(parseCreateProductFormData(formData)).toEqual({
      isActive: true,
      name: "Caneca personalizada",
      priceInReais: 35,
      sku: null,
    });
  });

  it("parses inactive products from explicit false values", () => {
    const formData = new FormData();
    formData.set("name", "Caneca personalizada");
    formData.set("priceInReais", "35");
    formData.set("isActive", "false");

    expect(parseCreateProductFormData(formData)).toEqual({
      isActive: false,
      name: "Caneca personalizada",
      priceInReais: 35,
      sku: null,
    });
  });

  it("uses invalid price when the price is missing or not a string", () => {
    const formData = new FormData();
    formData.set("name", "Caneca personalizada");
    formData.set("priceInReais", new File(["content"], "price.txt"));

    expect(parseCreateProductFormData(formData)).toMatchObject({
      name: "Caneca personalizada",
      priceInReais: Number.NaN,
    });
  });
});
