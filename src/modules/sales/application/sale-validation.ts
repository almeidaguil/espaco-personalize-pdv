import { z } from "zod";
import { paymentMethods } from "../domain/sale";

export const createSaleSchema = z.object({
  discountInCents: z
    .number()
    .int("Informe o desconto em centavos inteiros.")
    .nonnegative("O desconto nao pode ser negativo.")
    .safe("O desconto informado e muito alto."),
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
    amountInCents: z
      .number()
      .int("Informe um valor recebido em centavos inteiros.")
      .nonnegative("O valor recebido nao pode ser negativo.")
      .safe("O valor recebido informado e muito alto."),
    method: z.enum(paymentMethods),
  }),
});

export type CreateSaleUseCaseInput = z.infer<typeof createSaleSchema>;
