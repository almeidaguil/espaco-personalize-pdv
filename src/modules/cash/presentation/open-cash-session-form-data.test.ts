import { describe, expect, it } from "vitest";

import { parseOpenCashSessionFormData } from "./open-cash-session-form-data";

describe("parseOpenCashSessionFormData", () => {
  it("parses cash session form data into use case input", () => {
    const formData = new FormData();
    formData.set("eventId", " event-1 ");
    formData.set("openingAmountInReais", "R$ 150,50");

    expect(parseOpenCashSessionFormData(formData)).toEqual({
      eventId: "event-1",
      openingAmountInReais: 150.5,
    });
  });

  it("maps empty amounts to NaN", () => {
    const formData = new FormData();
    formData.set("openingAmountInReais", "");

    expect(
      Number.isNaN(parseOpenCashSessionFormData(formData).openingAmountInReais),
    ).toBe(true);
  });
});
