import { describe, expect, it } from "vitest";

import { parseCreateSaleFormData } from "./sale-form-data";

describe("parseCreateSaleFormData", () => {
  it("ignores a forged cash session id from sale form data", () => {
    const formData = new FormData();
    formData.set("cashSessionId", "forged-cash-session");
    formData.set("paymentMethod", "cash");
    formData.set(
      "itemsJson",
      JSON.stringify([
        {
          productId: "product-1",
          quantity: 2,
        },
      ]),
    );
    formData.set("amountReceivedInReais", "50,00");

    expect(parseCreateSaleFormData(formData)).toEqual({
      items: [
        {
          productId: "product-1",
          quantity: 2,
        },
      ],
      payment: {
        amountInReais: 50,
        method: "cash",
      },
    });
  });

  it("parses pix payments", () => {
    const formData = new FormData();
    formData.set("paymentMethod", "pix");
    formData.set("amountReceivedInReais", "30,00");

    expect(parseCreateSaleFormData(formData)).toMatchObject({
      payment: {
        amountInReais: 30,
        method: "pix",
      },
    });
  });

  it("returns an empty item list when item JSON is invalid", () => {
    const formData = new FormData();
    formData.set("itemsJson", "invalid");

    expect(parseCreateSaleFormData(formData)).toMatchObject({
      items: [],
    });
  });
});
