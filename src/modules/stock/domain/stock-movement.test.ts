import { describe, expect, it } from "vitest";

import { createStockMovement } from "./stock-movement";

describe("createStockMovement", () => {
  it("creates an initial adjustment movement", () => {
    const createdAt = new Date("2026-06-10T12:00:00.000Z");

    const result = createStockMovement({
      createdAt,
      id: "movement-1",
      productId: "product-1",
      quantityChange: 10,
      type: "initial_adjustment",
    });

    expect(result).toEqual({
      movement: {
        createdAt,
        id: "movement-1",
        productId: "product-1",
        quantityChange: 10,
        type: "initial_adjustment",
      },
      success: true,
    });
  });

  it("rejects invalid stock movement values", () => {
    const result = createStockMovement({
      createdAt: new Date("invalid"),
      id: " ",
      productId: " ",
      quantityChange: 0,
      type: "initial_adjustment",
    });

    expect(result).toEqual({
      errors: [
        {
          field: "id",
          message: "Stock movement id is required.",
        },
        {
          field: "productId",
          message: "Product id is required.",
        },
        {
          field: "quantityChange",
          message: "Stock movement quantity cannot be zero.",
        },
        {
          field: "createdAt",
          message: "Stock movement date must be valid.",
        },
      ],
      success: false,
    });
  });

  it("rejects fractional quantities", () => {
    const result = createStockMovement({
      createdAt: new Date("2026-06-10T12:00:00.000Z"),
      id: "movement-1",
      productId: "product-1",
      quantityChange: 1.5,
      type: "initial_adjustment",
    });

    expect(result).toEqual({
      errors: [
        {
          field: "quantityChange",
          message: "Stock movement quantity must be an integer.",
        },
      ],
      success: false,
    });
  });
});
