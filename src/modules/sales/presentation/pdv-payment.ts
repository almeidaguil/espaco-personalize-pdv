import type {
  InstallmentCount,
  PaymentMethod,
} from "@/shared/types/payment-method";
import {
  formatBrlCentsForInput,
  parseBrlCurrencyToCents,
} from "@/shared/utils/brl-currency";

export type PaymentDraft = {
  amountInput: string;
  installmentCount?: InstallmentCount;
  method: PaymentMethod;
};

export type PaymentDraftSummary = {
  changeInCents: number;
  error?: string;
  grossAmountInCents: number;
  isValid: boolean;
  netAmountInCents: number;
  remainingInCents: number;
};

export function normalizePaymentDraftsForTotal(
  drafts: PaymentDraft[],
  totalInCents: number,
): PaymentDraft[] {
  if (
    drafts.length !== 1 ||
    drafts[0]?.method === "cash" ||
    !Number.isSafeInteger(totalInCents) ||
    totalInCents < 0
  ) {
    return drafts;
  }

  return [
    {
      ...drafts[0],
      amountInput: formatBrlCentsForInput(totalInCents),
    },
  ];
}

export function summarizePaymentDrafts(
  drafts: PaymentDraft[],
  totalInCents: number,
): PaymentDraftSummary {
  const invalidSummary = (
    error: string,
    values: Partial<PaymentDraftSummary> = {},
  ): PaymentDraftSummary => ({
    changeInCents: 0,
    grossAmountInCents: 0,
    isValid: false,
    netAmountInCents: 0,
    remainingInCents: Math.max(totalInCents, 0),
    ...values,
    error,
  });

  if (!Number.isSafeInteger(totalInCents) || totalInCents <= 0) {
    return invalidSummary("Adicione itens para calcular o pagamento.");
  }

  if (drafts.length < 1 || drafts.length > 2) {
    return invalidSummary("Use uma ou duas formas de pagamento.");
  }

  if (new Set(drafts.map((draft) => draft.method)).size !== drafts.length) {
    return invalidSummary("As formas de pagamento devem ser diferentes.");
  }

  for (const draft of drafts) {
    if (
      draft.method === "credit_card" &&
      ![1, 2, 3].includes(draft.installmentCount ?? 0)
    ) {
      return invalidSummary("Selecione a quantidade de parcelas do crédito.");
    }

    if (
      draft.method !== "credit_card" &&
      draft.installmentCount !== undefined
    ) {
      return invalidSummary("Parcelamento é permitido apenas no crédito.");
    }
  }

  const parsedAmountsInCents = drafts.map((draft) =>
    parseBrlCurrencyToCents(draft.amountInput),
  );
  const hasInvalidAmount = parsedAmountsInCents.some(
    (amountInCents) =>
      !Number.isSafeInteger(amountInCents) || amountInCents <= 0,
  );
  const amountsInCents = parsedAmountsInCents.map((amountInCents) =>
    Number.isSafeInteger(amountInCents) && amountInCents > 0
      ? amountInCents
      : 0,
  );
  const grossAmountInCents = amountsInCents.reduce(
    (total, amountInCents) => total + amountInCents,
    0,
  );

  if (!Number.isSafeInteger(grossAmountInCents)) {
    return invalidSummary("O total informado é muito alto.");
  }

  if (hasInvalidAmount) {
    return invalidSummary("Informe valores válidos para todos os pagamentos.", {
      grossAmountInCents,
      netAmountInCents: grossAmountInCents,
      remainingInCents: Math.max(totalInCents - grossAmountInCents, 0),
    });
  }

  const remainingInCents = Math.max(totalInCents - grossAmountInCents, 0);
  if (remainingInCents > 0) {
    return invalidSummary(
      `Falta informar R$ ${formatBrlCentsForInput(remainingInCents)}.`,
      {
        grossAmountInCents,
        netAmountInCents: grossAmountInCents,
        remainingInCents,
      },
    );
  }

  const cashIndex = drafts.findIndex((draft) => draft.method === "cash");
  const excessInCents = grossAmountInCents - totalInCents;

  if (excessInCents > 0 && cashIndex < 0) {
    return invalidSummary(
      "A soma dos pagamentos sem dinheiro deve ser exata.",
      {
        grossAmountInCents,
        netAmountInCents: grossAmountInCents,
        remainingInCents: 0,
      },
    );
  }

  const changeInCents = cashIndex >= 0 ? excessInCents : 0;
  const contributions = amountsInCents.map((amountInCents, index) =>
    index === cashIndex ? amountInCents - changeInCents : amountInCents,
  );
  const netAmountInCents = contributions.reduce(
    (total, contribution) => total + contribution,
    0,
  );

  if (contributions.some((contribution) => contribution < 1)) {
    return invalidSummary(
      "Cada forma de pagamento deve contribuir com pelo menos R$ 0,01.",
      {
        changeInCents,
        grossAmountInCents,
        netAmountInCents,
        remainingInCents: 0,
      },
    );
  }

  return {
    changeInCents,
    grossAmountInCents,
    isValid: netAmountInCents === totalInCents,
    netAmountInCents,
    remainingInCents: 0,
  };
}
