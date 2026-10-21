import { z } from "zod";
import { paymentMethods } from "@/shared/types/payment-method";

import { validateCashSessionReconciliations } from "../domain/cash-session";

const reconciliationError =
  "Informe a conferencia dos quatro metodos de pagamento.";

export const openCashSessionSchema = z.object({
  openingAmountInReais: z
    .number({ error: "Informe um valor inicial valido em Reais." })
    .finite("Informe um valor inicial valido em Reais.")
    .min(0, "O valor inicial nao pode ser negativo.")
    .refine(
      (openingAmountInReais) =>
        Math.abs(
          openingAmountInReais * 100 - Math.round(openingAmountInReais * 100),
        ) < 1e-8,
      "Informe o valor inicial com no maximo 2 casas decimais.",
    ),
});

export const closeCashSessionSchema = z.object({
  adminPassword: z.string().trim().optional(),
  cashSessionId: z.string().trim().min(1, "Informe o caixa aberto."),
  reconciliations: z
    .array(
      z.object({
        countedAmountInCents: z
          .number({ error: reconciliationError })
          .int(reconciliationError)
          .min(0, reconciliationError)
          .max(Number.MAX_SAFE_INTEGER, reconciliationError),
        method: z.enum(paymentMethods, { error: reconciliationError }),
      }),
    )
    .superRefine((reconciliations, context) => {
      if (!validateCashSessionReconciliations(reconciliations).success) {
        context.addIssue({
          code: "custom",
          message: reconciliationError,
        });
      }
    }),
});

export type CloseCashSessionUseCaseInput = z.infer<
  typeof closeCashSessionSchema
>;
export type OpenCashSessionUseCaseInput = z.infer<typeof openCashSessionSchema>;
