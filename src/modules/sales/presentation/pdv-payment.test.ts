import { describe, expect, it } from "vitest";

import type { PaymentDraft } from "./pdv-payment";
import { summarizePaymentDrafts } from "./pdv-payment";

describe("summarizePaymentDrafts", () => {
  it("accepts an exact single non-cash payment", () => {
    expect(
      summarizePaymentDrafts([{ amountInput: "15,00", method: "pix" }], 1500),
    ).toEqual({
      changeInCents: 0,
      grossAmountInCents: 1500,
      isValid: true,
      netAmountInCents: 1500,
      remainingInCents: 0,
    });
  });

  it("calculates change only from cash", () => {
    expect(
      summarizePaymentDrafts(
        [
          { amountInput: "10,00", method: "pix" },
          { amountInput: "7,00", method: "cash" },
        ],
        1500,
      ),
    ).toEqual({
      changeInCents: 200,
      grossAmountInCents: 1700,
      isValid: true,
      netAmountInCents: 1500,
      remainingInCents: 0,
    });
  });

  it("reports the remaining value when payment is insufficient", () => {
    expect(
      summarizePaymentDrafts([{ amountInput: "10,00", method: "cash" }], 1500),
    ).toEqual({
      changeInCents: 0,
      error: "Falta informar R$ 5,00.",
      grossAmountInCents: 1000,
      isValid: false,
      netAmountInCents: 1000,
      remainingInCents: 500,
    });
  });

  it("includes entered split amounts when another payment is still blank", () => {
    expect(
      summarizePaymentDrafts(
        [
          {
            amountInput: "50,00",
            installmentCount: 3,
            method: "credit_card",
          },
          { amountInput: "", method: "cash" },
        ],
        7000,
      ),
    ).toEqual({
      changeInCents: 0,
      error: "Informe valores válidos para todos os pagamentos.",
      grossAmountInCents: 5000,
      isValid: false,
      netAmountInCents: 5000,
      remainingInCents: 2000,
    });
  });

  it("preserves valid entered amounts when another split amount is malformed", () => {
    expect(
      summarizePaymentDrafts(
        [
          { amountInput: "50,00", method: "credit_card", installmentCount: 3 },
          { amountInput: "inválido", method: "cash" },
        ],
        7000,
      ),
    ).toMatchObject({
      error: "Informe valores válidos para todos os pagamentos.",
      grossAmountInCents: 5000,
      isValid: false,
      netAmountInCents: 5000,
      remainingInCents: 2000,
    });
  });

  it("rejects excess without cash", () => {
    expect(
      summarizePaymentDrafts(
        [
          { amountInput: "10,00", method: "pix" },
          { amountInput: "6,00", method: "debit_card" },
        ],
        1500,
      ),
    ).toMatchObject({
      changeInCents: 0,
      error: "A soma dos pagamentos sem dinheiro deve ser exata.",
      grossAmountInCents: 1600,
      isValid: false,
      netAmountInCents: 1600,
      remainingInCents: 0,
    });
  });

  it("rejects a split whose cash net contribution becomes zero", () => {
    expect(
      summarizePaymentDrafts(
        [
          { amountInput: "15,00", method: "pix" },
          { amountInput: "5,00", method: "cash" },
        ],
        1500,
      ),
    ).toMatchObject({
      changeInCents: 500,
      error: "Cada forma de pagamento deve contribuir com pelo menos R$ 0,01.",
      isValid: false,
      netAmountInCents: 1500,
    });
  });

  it.each(["", "texto", "-0,01", "1,001", "90071992547410,00"])(
    "rejects invalid BRL input %s without rounding",
    (amountInput) => {
      expect(
        summarizePaymentDrafts([{ amountInput, method: "cash" }], 1500),
      ).toMatchObject({
        error: "Informe valores válidos para todos os pagamentos.",
        isValid: false,
      });
    },
  );

  it("rejects duplicate methods and more than two drafts", () => {
    expect(
      summarizePaymentDrafts(
        [
          { amountInput: "5,00", method: "pix" },
          { amountInput: "10,00", method: "pix" },
        ],
        1500,
      ),
    ).toMatchObject({
      error: "As formas de pagamento devem ser diferentes.",
      isValid: false,
    });

    expect(
      summarizePaymentDrafts(
        [
          { amountInput: "5,00", method: "cash" },
          { amountInput: "5,00", method: "pix" },
          { amountInput: "5,00", method: "debit_card" },
        ],
        1500,
      ),
    ).toMatchObject({
      error: "Use uma ou duas formas de pagamento.",
      isValid: false,
    });
  });

  it("validates installment structure", () => {
    const invalidCredit = {
      amountInput: "15,00",
      method: "credit_card",
    } as PaymentDraft;
    const installmentOnPix = {
      amountInput: "15,00",
      installmentCount: 2,
      method: "pix",
    } as PaymentDraft;

    expect(summarizePaymentDrafts([invalidCredit], 1500)).toMatchObject({
      error: "Selecione a quantidade de parcelas do crédito.",
      isValid: false,
    });
    expect(summarizePaymentDrafts([installmentOnPix], 1500)).toMatchObject({
      error: "Parcelamento é permitido apenas no crédito.",
      isValid: false,
    });
  });

  it("recalculates remaining and change when the sale total changes", () => {
    const drafts: PaymentDraft[] = [{ amountInput: "20,00", method: "cash" }];

    expect(summarizePaymentDrafts(drafts, 1500)).toMatchObject({
      changeInCents: 500,
      isValid: true,
      remainingInCents: 0,
    });
    expect(summarizePaymentDrafts(drafts, 2500)).toMatchObject({
      changeInCents: 0,
      isValid: false,
      remainingInCents: 500,
    });
  });
});
