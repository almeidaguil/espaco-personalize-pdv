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
    formData.set("discountInReais", "1,25");

    expect(parseCreateSaleFormData(formData)).toEqual({
      items: [
        {
          productId: "product-1",
          quantity: 2,
        },
      ],
      discountInCents: 125,
      payment: {
        amountInCents: 5000,
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
        amountInCents: 3000,
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

  it("uses zero when the discount field is empty", () => {
    const formData = new FormData();
    formData.set("amountReceivedInReais", "10,00");

    expect(parseCreateSaleFormData(formData)).toMatchObject({
      discountInCents: 0,
    });
  });

  it("does not round invalid monetary input", () => {
    const formData = new FormData();
    formData.set("amountReceivedInReais", "10,001");
    formData.set("discountInReais", "-0,01");

    const parsed = parseCreateSaleFormData(formData);

    expect(parsed.discountInCents).toBeNaN();
    expect(parsed.payment.amountInCents).toBeNaN();
  });
});
