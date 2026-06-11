import { z } from "zod";

export const createSaleSchema = z.object({
  cashSessionId: z.string().trim().min(1, "Informe o caixa."),
  eventId: z.string().trim().min(1, "Informe o evento."),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1, "Informe o produto."),
        quantity: z
          .number()
          .int("Informe uma quantidade inteira.")
          .positive("A quantidade deve ser maior que zero."),
      }),
    )
    .min(1, "Adicione pelo menos um item."),
  payment: z.object({
    amountInReais: z
      .number()
      .finite("Informe um valor recebido valido em Reais.")
      .min(0, "O valor recebido nao pode ser negativo.")
      .refine(
        (amountInReais) =>
          Math.abs(amountInReais * 100 - Math.round(amountInReais * 100)) <
          1e-8,
        "Informe o valor recebido com no maximo 2 casas decimais.",
      ),
    method: z.literal("cash"),
  }),
});

export type CreateSaleUseCaseInput = z.infer<typeof createSaleSchema>;
