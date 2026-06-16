import { describe, expect, it } from "vitest";

import { parseCloseCashSessionFormData } from "./close-cash-session-form-data";

describe("parseCloseCashSessionFormData", () => {
  it("parses and trims the selected cash session", () => {
    const formData = new FormData();
    formData.set("cashSessionId", " cash-session-1 ");
    formData.set("countedAmountInReais", "R$ 250,75");

    expect(parseCloseCashSessionFormData(formData)).toEqual({
      cashSessionId: "cash-session-1",
      countedAmountInReais: 250.75,
    });
  });

  it("parses the admin password when cash is short", () => {
    const formData = new FormData();
    formData.set("cashSessionId", "cash-session-1");
    formData.set("countedAmountInReais", "200,00");
    formData.set("adminPassword", " 123456 ");

    expect(parseCloseCashSessionFormData(formData)).toEqual({
      adminPassword: "123456",
      cashSessionId: "cash-session-1",
      countedAmountInReais: 200,
    });
  });

  it("returns an empty cash session id when the field is missing", () => {
    expect(parseCloseCashSessionFormData(new FormData())).toEqual({
      cashSessionId: "",
      countedAmountInReais: Number.NaN,
    });
  });
});
