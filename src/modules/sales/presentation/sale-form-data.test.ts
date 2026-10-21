import { describe, expect, it } from "vitest";

import { parseCreateSaleFormData } from "./sale-form-data";

describe("parseCreateSaleFormData", () => {
  it("parses two payments and ignores a forged cash session id", () => {
    const formData = new FormData();
    formData.set("cashSessionId", "forged-cash-session");
    formData.set(
      "itemsJson",
      JSON.stringify([{ productId: "product-1", quantity: 2 }]),
    );
    formData.set("discountInReais", "1,25");
    formData.set(
      "paymentsJson",
      JSON.stringify([
        { amountInReais: "10,00", method: "pix" },
        {
          amountInReais: "18,75",
          installmentCount: 3,
          method: "credit_card",
        },
      ]),
    );

    expect(parseCreateSaleFormData(formData)).toEqual({
      discountInCents: 125,
      items: [{ productId: "product-1", quantity: 2 }],
      payments: [
        { amountInCents: 1000, method: "pix" },
        {
          amountInCents: 1875,
          installmentCount: 3,
          method: "credit_card",
        },
      ],
    });
  });

  it("returns empty arrays when JSON fields are malformed", () => {
    const formData = new FormData();
    formData.set("itemsJson", "invalid");
    formData.set("paymentsJson", "invalid");

    expect(parseCreateSaleFormData(formData)).toMatchObject({
      items: [],
      payments: [],
    });
  });

  it("uses zero when the discount field is empty", () => {
    expect(parseCreateSaleFormData(new FormData())).toMatchObject({
      discountInCents: 0,
    });
  });

  it.each(["", "texto", "-0,01", "10,001", "90071992547410,00"])(
    "does not round or coerce invalid payment value %s",
    (amountInReais) => {
      const formData = new FormData();
      formData.set(
        "paymentsJson",
        JSON.stringify([{ amountInReais, method: "cash" }]),
      );

      expect(
        parseCreateSaleFormData(formData).payments[0]?.amountInCents,
      ).toBeNaN();
    },
  );

  it("preserves invalid methods and installments for server validation", () => {
    const formData = new FormData();
    formData.set(
      "paymentsJson",
      JSON.stringify([
        { amountInReais: "10,00", method: "voucher" },
        {
          amountInReais: "5,00",
          installmentCount: "quatro",
          method: "credit_card",
        },
      ]),
    );

    expect(parseCreateSaleFormData(formData).payments).toEqual([
      { amountInCents: 1000, method: "voucher" },
      {
        amountInCents: 500,
        installmentCount: Number.NaN,
        method: "credit_card",
      },
    ]);
  });

  it("does not accept a non-array payment payload", () => {
    const formData = new FormData();
    formData.set(
      "paymentsJson",
      JSON.stringify({ amountInReais: "10,00", method: "cash" }),
    );

    expect(parseCreateSaleFormData(formData).payments).toEqual([]);
  });
});
