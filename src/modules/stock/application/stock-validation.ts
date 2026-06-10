import { z } from "zod";

export const adjustInitialStockSchema = z.object({
  productId: z.string().trim().min(1, "Informe o produto."),
  quantity: z
    .number()
    .int("Informe uma quantidade inteira.")
    .min(1, "Informe uma quantidade maior que zero."),
});

export type AdjustInitialStockUseCaseInput = z.infer<
  typeof adjustInitialStockSchema
>;
