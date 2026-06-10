import { describe, expect, it } from "vitest";

import { Money } from "./money";
import { activateProduct, createProduct, deactivateProduct } from "./product";

describe("createProduct", () => {
  it("creates an active product with normalized fields", () => {
    const result = createProduct({
      id: " product-1 ",
      name: " Caneca personalizada ",
      priceInReais: 35,
      sku: " CANECA-001 ",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.product).toMatchObject({
        id: "product-1",
        isActive: true,
        name: "Caneca personalizada",
        sku: "CANECA-001",
      });
      expect(result.product.price.currency).toBe("BRL");
      expect(result.product.price.toReais()).toBe(35);
      expect(result.product.price.toCents()).toBe(3500);
    }
  });

  it("does not expose stock as product state", () => {
    const result = createProduct({
      id: "product-1",
      name: "Caneca personalizada",
      priceInReais: 35,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.product).not.toHaveProperty("stock");
      expect(result.product).not.toHaveProperty("quantity");
    }
  });

  it("rejects products without name", () => {
    const result = createProduct({
      id: "product-1",
      name: " ",
      priceInReais: 35,
    });

    expect(result).toEqual({
      errors: [
        {
          field: "name",
          message: "Product name is required.",
        },
      ],
      success: false,
    });
  });

  it("rejects negative prices", () => {
    const result = createProduct({
      id: "product-1",
      name: "Caneca personalizada",
      priceInReais: -1,
    });

    expect(result).toEqual({
      errors: [
        {
          field: "priceInReais",
          message: "Product price cannot be negative.",
        },
      ],
      success: false,
    });
  });

  it("accepts prices with cents in Reais", () => {
    const result = createProduct({
      id: "product-1",
      name: "Caneca personalizada",
      priceInReais: 35.99,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.product.price.toReais()).toBe(35.99);
      expect(result.product.price.toCents()).toBe(3599);
    }
  });

  it("rejects prices with more than 2 decimal places", () => {
    const result = createProduct({
      id: "product-1",
      name: "Caneca personalizada",
      priceInReais: 35.999,
    });

    expect(result).toEqual({
      errors: [
        {
          field: "priceInReais",
          message: "Product price can have at most 2 decimal places.",
        },
      ],
      success: false,
    });
  });

  it("rejects invalid prices in Reais", () => {
    const result = createProduct({
      id: "product-1",
      name: "Caneca personalizada",
      priceInReais: Number.NaN,
    });

    expect(result).toEqual({
      errors: [
        {
          field: "priceInReais",
          message: "Product price must be a valid BRL amount.",
        },
      ],
      success: false,
    });
  });
});

describe("product activation", () => {
  it("deactivates a product without changing business data", () => {
    const product = {
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      price: Money.fromReais(35),
      sku: "CANECA-001",
    };

    expect(deactivateProduct(product)).toEqual({
      ...product,
      isActive: false,
    });
  });

  it("activates a product without changing business data", () => {
    const product = {
      id: "product-1",
      isActive: false,
      name: "Caneca personalizada",
      price: Money.fromReais(35),
      sku: "CANECA-001",
    };

    expect(activateProduct(product)).toEqual({
      ...product,
      isActive: true,
    });
  });
});
