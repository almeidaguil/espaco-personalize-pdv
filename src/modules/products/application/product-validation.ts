import { z } from "zod";

export const createProductSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1, "Informe o nome do produto."),
  priceInCents: z
    .number()
    .int("Informe o preco em centavos.")
    .min(0, "O preco nao pode ser negativo."),
  sku: z
    .string()
    .trim()
    .max(64, "O SKU deve ter no maximo 64 caracteres.")
    .optional()
    .nullable(),
});

export type CreateProductUseCaseInput = z.infer<typeof createProductSchema>;
