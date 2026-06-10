import { describe, expect, it } from "vitest";

import { applyStockMovement, calculateStockBalance } from "./stock-balance";
import type { StockMovement } from "./stock-movement";

describe("calculateStockBalance", () => {
  it("calculates quantity on hand from stock movements", () => {
    expect(
      calculateStockBalance([
        createMovement({ quantityChange: 10 }),
        createMovement({ quantityChange: -3 }),
        createMovement({ quantityChange: 2 }),
      ]),
    ).toBe(9);
  });
});

describe("applyStockMovement", () => {
  it("applies a stock movement when the balance stays non-negative", () => {
    const result = applyStockMovement(
      5,
      createMovement({ quantityChange: -2 }),
    );

    expect(result).toEqual({
      quantityOnHand: 3,
      success: true,
    });
  });

  it("rejects movements that would make stock negative", () => {
    const result = applyStockMovement(
      1,
      createMovement({ quantityChange: -2 }),
    );

    expect(result).toEqual({
      errors: [{ message: "Stock cannot become negative." }],
      success: false,
    });
  });

  it("rejects invalid current stock quantities", () => {
    const result = applyStockMovement(
      1.5,
      createMovement({ quantityChange: 1 }),
    );

    expect(result).toEqual({
      errors: [{ message: "Current stock quantity must be an integer." }],
      success: false,
    });
  });
});

function createMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    id: "movement-1",
    productId: "product-1",
    quantityChange: 1,
    type: "manual_adjustment",
    ...overrides,
  };
}
