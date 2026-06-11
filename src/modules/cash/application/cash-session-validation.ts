import { z } from "zod";

export const openCashSessionSchema = z.object({
  eventId: z.string().trim().min(1, "Informe o evento."),
  openingAmountInReais: z
    .number()
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
  cashSessionId: z.string().trim().min(1, "Informe o caixa aberto."),
});

export type CloseCashSessionUseCaseInput = z.infer<
  typeof closeCashSessionSchema
>;
export type OpenCashSessionUseCaseInput = z.infer<typeof openCashSessionSchema>;
