import { z } from "zod";

export const stockAdjustmentTypes = [
  "initial_adjustment",
  "manual_adjustment",
] as const;

export const adjustStockSchema = z
  .object({
    productId: z.string().trim().min(1, "Informe o produto."),
    quantity: z.number().int("Informe uma quantidade inteira."),
    type: z.enum(stockAdjustmentTypes),
  })
  .superRefine((input, context) => {
    if (input.type === "initial_adjustment" && input.quantity < 1) {
      context.addIssue({
        code: "custom",
        message: "Informe uma quantidade maior que zero.",
        path: ["quantity"],
      });
    }

    if (input.type === "manual_adjustment" && input.quantity === 0) {
      context.addIssue({
        code: "custom",
        message: "Informe uma quantidade diferente de zero.",
        path: ["quantity"],
      });
    }
  });

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

export type AdjustStockUseCaseInput = z.infer<typeof adjustStockSchema>;
