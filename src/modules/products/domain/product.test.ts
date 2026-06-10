import { describe, expect, it } from "vitest";

import { activateProduct, createProduct, deactivateProduct } from "./product";

describe("createProduct", () => {
  it("creates an active product with normalized fields", () => {
    const result = createProduct({
      id: " product-1 ",
      name: " Caneca personalizada ",
      priceInCents: 3500,
      sku: " CANECA-001 ",
    });

    expect(result).toEqual({
      product: {
        id: "product-1",
        isActive: true,
        name: "Caneca personalizada",
        priceInCents: 3500,
        sku: "CANECA-001",
      },
      success: true,
    });
  });

  it("does not expose stock as product state", () => {
    const result = createProduct({
      id: "product-1",
      name: "Caneca personalizada",
      priceInCents: 3500,
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
      priceInCents: 3500,
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
      priceInCents: -1,
    });

    expect(result).toEqual({
      errors: [
        {
          field: "priceInCents",
          message: "Product price cannot be negative.",
        },
      ],
      success: false,
    });
  });

  it("rejects prices that are not represented in cents", () => {
    const result = createProduct({
      id: "product-1",
      name: "Caneca personalizada",
      priceInCents: 10.5,
    });

    expect(result).toEqual({
      errors: [
        {
          field: "priceInCents",
          message: "Product price must be represented in cents.",
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
      priceInCents: 3500,
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
      priceInCents: 3500,
      sku: "CANECA-001",
    };

    expect(activateProduct(product)).toEqual({
      ...product,
      isActive: true,
    });
  });
});
