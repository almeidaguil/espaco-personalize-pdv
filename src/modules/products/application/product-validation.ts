import { z } from "zod";

import { normalizeProductSku } from "../domain/product";

export const createProductSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1, "Informe o nome do produto."),
  priceInReais: z
    .number()
    .finite("Informe um preco valido em Reais.")
    .min(0, "O preco nao pode ser negativo.")
    .refine(
      (priceInReais) =>
        Math.abs(priceInReais * 100 - Math.round(priceInReais * 100)) < 1e-8,
      "Informe o preco com no maximo 2 casas decimais.",
    ),
  sku: z
    .string()
    .optional()
    .nullable()
    .transform(normalizeProductSku)
    .refine((sku) => !sku || sku.length <= 64, {
      message: "O SKU deve ter no maximo 64 caracteres.",
    }),
});

export type CreateProductUseCaseInput = z.input<typeof createProductSchema>;
