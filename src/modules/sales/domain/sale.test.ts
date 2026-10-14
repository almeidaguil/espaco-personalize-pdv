import { describe, expect, it } from "vitest";

import { createSale, type CreateSaleInput } from "./sale";

function saleInput(overrides: Partial<CreateSaleInput> = {}): CreateSaleInput {
  return {
    cashSessionId: "cash-session-1",
    completedAt: new Date("2026-07-10T12:00:00.000Z"),
    discountInCents: 0,
    id: "sale-1",
    items: [
      {
        productId: "product-1",
        productName: "Chaveiro Polvo",
        quantity: 2,
        unitPriceInCents: 1500,
      },
    ],
    payment: { amountInCents: 3000, method: "cash" },
    ...overrides,
  };
}

describe("createSale", () => {
  it("creates a completed sale without discount using integer cents", () => {
    const result = createSale(
      saleInput({
        items: [
          {
            productId: "product-1",
            productName: "Chaveiro Polvo",
            quantity: 2,
            unitPriceInCents: 1500,
          },
          {
            productId: "product-2",
            productName: "Caneca",
            quantity: 1,
            unitPriceInCents: 2550,
          },
        ],
        payment: { amountInCents: 6000, method: "cash" },
      }),
    );

    expect(result).toEqual({
      sale: {
        cashSessionId: "cash-session-1",
        completedAt: new Date("2026-07-10T12:00:00.000Z"),
        discountInCents: 0,
        id: "sale-1",
        items: [
          {
            productId: "product-1",
            productName: "Chaveiro Polvo",
            quantity: 2,
            totalInCents: 3000,
            unitPriceInCents: 1500,
          },
          {
            productId: "product-2",
            productName: "Caneca",
            quantity: 1,
            totalInCents: 2550,
            unitPriceInCents: 2550,
          },
        ],
        payment: {
          amountInCents: 6000,
          changeInCents: 450,
          method: "cash",
        },
        status: "completed",
        subtotalInCents: 5550,
        totalInCents: 5550,
      },
      success: true,
    });
  });

  it.each([
    [1, 2999],
    [2999, 1],
  ])(
    "applies a valid discount of %i cents and leaves a positive total",
    (discountInCents, totalInCents) => {
      const result = createSale(
        saleInput({
          discountInCents,
          payment: { amountInCents: totalInCents, method: "pix" },
        }),
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.sale).toMatchObject({
          discountInCents,
          subtotalInCents: 3000,
          totalInCents,
          payment: { amountInCents: totalInCents, changeInCents: 0 },
        });
      }
    },
  );

  it.each([3000, 3001])(
    "rejects discount %i when it does not leave at least one cent",
    (discountInCents) => {
      const result = createSale(
        saleInput({
          discountInCents,
          payment: { amountInCents: 0, method: "cash" },
        }),
      );

      expect(result).toEqual({
        errors: [
          {
            field: "discount",
            message: "Sale discount must be lower than the subtotal.",
          },
        ],
        success: false,
      });
    },
  );

  it("rejects zero subtotal sales", () => {
    const result = createSale(
      saleInput({
        items: [
          {
            productId: "product-1",
            productName: "Brinde",
            quantity: 1,
            unitPriceInCents: 0,
          },
        ],
        payment: { amountInCents: 0, method: "cash" },
      }),
    );

    expect(result).toEqual({
      errors: [
        {
          field: "items",
          message: "Sale subtotal must be greater than zero.",
        },
      ],
      success: false,
    });
  });

  it("rejects invalid identifiers, date and empty items", () => {
    const result = createSale(
      saleInput({
        cashSessionId: "",
        completedAt: new Date("invalid"),
        id: "",
        items: [],
        payment: { amountInCents: 0, method: "cash" },
      }),
    );

    expect(result).toEqual({
      errors: [
        { field: "id", message: "Sale id is required." },
        {
          field: "cashSessionId",
          message: "Sale cash session id is required.",
        },
        {
          field: "completedAt",
          message: "Sale completion date must be valid.",
        },
        { field: "items", message: "Sale must have at least one item." },
      ],
      success: false,
    });
  });

  it("rejects invalid item and payment cents", () => {
    const result = createSale(
      saleInput({
        items: [
          {
            productId: "",
            productName: "",
            quantity: 0,
            unitPriceInCents: 1500.5,
          },
        ],
        payment: { amountInCents: -1, method: "cash" },
      }),
    );

    expect(result).toEqual({
      errors: [
        { field: "items", message: "Sale item product data is required." },
        {
          field: "items",
          message: "Sale item quantity must be a positive integer.",
        },
        {
          field: "items",
          message: "Sale item unit price must be a non-negative integer.",
        },
        {
          field: "payment",
          message: "Payment amount must be a non-negative integer.",
        },
      ],
      success: false,
    });
  });

  it("calculates cash change from the discounted total", () => {
    const result = createSale(
      saleInput({
        discountInCents: 500,
        payment: { amountInCents: 3000, method: "cash" },
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sale.payment.changeInCents).toBe(500);
      expect(result.sale.totalInCents).toBe(2500);
    }
  });

  it.each(["pix", "credit_card", "debit_card"] as const)(
    "accepts an exact %s payment and rejects a different amount",
    (method) => {
      const accepted = createSale(
        saleInput({
          discountInCents: 500,
          payment: { amountInCents: 2500, method },
        }),
      );
      const rejected = createSale(
        saleInput({
          discountInCents: 500,
          payment: { amountInCents: 2501, method },
        }),
      );

      expect(accepted.success).toBe(true);
      expect(rejected).toEqual({
        errors: [
          {
            field: "payment",
            message: "Non-cash payments must match the sale total exactly.",
          },
        ],
        success: false,
      });
    },
  );
});
