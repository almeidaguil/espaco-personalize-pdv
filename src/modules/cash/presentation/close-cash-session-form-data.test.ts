import { describe, expect, it } from "vitest";

import { parseCloseCashSessionFormData } from "./close-cash-session-form-data";

describe("parseCloseCashSessionFormData", () => {
  it("parses all counted payment methods in cents", () => {
    const formData = createFormData();
    formData.set("cashSessionId", " cash-session-1 ");

    expect(parseCloseCashSessionFormData(formData)).toEqual({
      cashSessionId: "cash-session-1",
      reconciliations: [
        { countedAmountInCents: 25075, method: "cash" },
        { countedAmountInCents: 0, method: "pix" },
        { countedAmountInCents: 20000, method: "credit_card" },
        { countedAmountInCents: 5000, method: "debit_card" },
      ],
    });
  });

  it("parses and trims the admin password", () => {
    const formData = createFormData();
    formData.set("cashSessionId", "cash-session-1");
    formData.set("adminPassword", " admin-password-test ");

    expect(parseCloseCashSessionFormData(formData)).toMatchObject({
      adminPassword: "admin-password-test",
    });
  });

  it("keeps missing counted values invalid", () => {
    const parsed = parseCloseCashSessionFormData(new FormData());

    expect(parsed.cashSessionId).toBe("");
    expect(
      parsed.reconciliations.every((item) =>
        Number.isNaN(item.countedAmountInCents),
      ),
    ).toBe(true);
  });
});

function createFormData(): FormData {
  const formData = new FormData();
  formData.set("countedAmount_cash", "R$ 250,75");
  formData.set("countedAmount_pix", "0,00");
  formData.set("countedAmount_credit_card", "200,00");
  formData.set("countedAmount_debit_card", "50,00");
  return formData;
}
