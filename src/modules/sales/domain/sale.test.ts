import { describe, expect, it } from "vitest";

import { createSale } from "./sale";

describe("createSale", () => {
  it("creates a completed sale with calculated totals and change", () => {
    const result = createSale({
      cashSessionId: "cash-session-1",
      completedAt: new Date("2026-07-10T12:00:00.000Z"),
      eventId: "event-1",
      id: "sale-1",
      items: [
        {
          productId: "product-1",
          productName: "Chaveiro Polvo",
          quantity: 2,
          unitPriceInReais: 15,
        },
        {
          productId: "product-2",
          productName: "Caneca",
          quantity: 1,
          unitPriceInReais: 25.5,
        },
      ],
      payment: {
        amountInReais: 60,
        method: "cash",
      },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.sale).toEqual({
        cashSessionId: "cash-session-1",
        completedAt: new Date("2026-07-10T12:00:00.000Z"),
        eventId: "event-1",
        id: "sale-1",
        items: [
          {
            productId: "product-1",
            productName: "Chaveiro Polvo",
            quantity: 2,
            totalInReais: 30,
            unitPriceInReais: 15,
          },
          {
            productId: "product-2",
            productName: "Caneca",
            quantity: 1,
            totalInReais: 25.5,
            unitPriceInReais: 25.5,
          },
        ],
        payment: {
          amountInReais: 60,
          changeInReais: 4.5,
          method: "cash",
        },
        status: "completed",
        totalInReais: 55.5,
      });
    }
  });

  it("rejects sales without event, cash session or items", () => {
    const result = createSale({
      cashSessionId: "",
      completedAt: new Date("invalid"),
      eventId: "",
      id: "",
      items: [],
      payment: {
        amountInReais: 0,
        method: "cash",
      },
    });

    expect(result).toEqual({
      errors: [
        { field: "id", message: "Sale id is required." },
        { field: "eventId", message: "Sale event id is required." },
        {
          field: "cashSessionId",
          message: "Sale cash session id is required.",
        },
        {
          field: "completedAt",
          message: "Sale completion date must be valid.",
        },
        {
          field: "items",
          message: "Sale must have at least one item.",
        },
      ],
      success: false,
    });
  });

  it("rejects invalid sale items", () => {
    const result = createSale({
      cashSessionId: "cash-session-1",
      completedAt: new Date("2026-07-10T12:00:00.000Z"),
      eventId: "event-1",
      id: "sale-1",
      items: [
        {
          productId: "",
          productName: "",
          quantity: 0,
          unitPriceInReais: 15.123,
        },
      ],
      payment: {
        amountInReais: 20,
        method: "cash",
      },
    });

    expect(result).toEqual({
      errors: [
        {
          field: "items",
          message: "Sale item product data is required.",
        },
        {
          field: "items",
          message: "Sale item quantity must be a positive integer.",
        },
        {
          field: "items",
          message: "Sale item unit price can have at most 2 decimal places.",
        },
      ],
      success: false,
    });
  });

  it("rejects insufficient cash payments", () => {
    const result = createSale({
      cashSessionId: "cash-session-1",
      completedAt: new Date("2026-07-10T12:00:00.000Z"),
      eventId: "event-1",
      id: "sale-1",
      items: [
        {
          productId: "product-1",
          productName: "Chaveiro Polvo",
          quantity: 2,
          unitPriceInReais: 15,
        },
      ],
      payment: {
        amountInReais: 20,
        method: "cash",
      },
    });

    expect(result).toEqual({
      errors: [
        {
          field: "payment",
          message: "Payment amount must cover the sale total.",
        },
      ],
      success: false,
    });
  });

  it("creates card payments without change when the amount matches the total", () => {
    const result = createSale({
      cashSessionId: "cash-session-1",
      completedAt: new Date("2026-07-10T12:00:00.000Z"),
      eventId: "event-1",
      id: "sale-1",
      items: [
        {
          productId: "product-1",
          productName: "Chaveiro Polvo",
          quantity: 2,
          unitPriceInReais: 15,
        },
      ],
      payment: {
        amountInReais: 30,
        method: "pix",
      },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.sale.payment).toEqual({
        amountInReais: 30,
        changeInReais: 0,
        method: "pix",
      });
    }
  });

  it("rejects non-cash payments when the amount differs from the total", () => {
    const result = createSale({
      cashSessionId: "cash-session-1",
      completedAt: new Date("2026-07-10T12:00:00.000Z"),
      eventId: "event-1",
      id: "sale-1",
      items: [
        {
          productId: "product-1",
          productName: "Chaveiro Polvo",
          quantity: 2,
          unitPriceInReais: 15,
        },
      ],
      payment: {
        amountInReais: 25,
        method: "credit_card",
      },
    });

    expect(result).toEqual({
      errors: [
        {
          field: "payment",
          message: "Non-cash payments must match the sale total exactly.",
        },
      ],
      success: false,
    });
  });
});
