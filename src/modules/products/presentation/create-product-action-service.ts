import { z } from "zod";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import { requireAdminUseCase } from "@/modules/auth/application/require-admin-use-case";
import { adjustInitialStockUseCase } from "@/modules/stock/application/adjust-initial-stock-use-case";
import type { StockMovementRepository } from "@/modules/stock/application/stock-movement-repository";
import { createProductUseCase } from "../application/create-product-use-case";
import type { ProductRepository } from "../application/product-repository";
import type { ProductActionState } from "./product-action-state";
import {
  createEmptyProductFormValues,
  getProductFormValues,
  parseCreateProductFormData,
} from "./product-form-data";

type Dependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  productRepository: ProductRepository;
  stockMovementRepository: StockMovementRepository;
  generateProductId: () => string;
  generateStockMovementId: () => string;
  getCurrentDate: () => Date;
};

const initialQuantitySchema = z
  .string()
  .trim()
  .regex(/^\d*$/, "Informe uma quantidade inteira maior ou igual a zero.")
  .transform((value) => Number(value || "0"))
  .pipe(
    z
      .number()
      .int()
      .min(0)
      .max(2147483647, "A quantidade máxima é 2147483647."),
  );

export async function createProductActionService(
  formData: FormData,
  dependencies: Dependencies,
): Promise<ProductActionState> {
  const values = getProductFormValues(formData);
  const authorization = await requireAdminUseCase(
    dependencies.currentUserProfileRepository,
  );
  if (!authorization.success)
    return { formError: authorization.formError, values };

  const quantity = initialQuantitySchema.safeParse(
    formData.get("initialStockQuantity") ?? "",
  );
  if (!quantity.success) {
    return {
      fieldErrors: { initialStockQuantity: quantity.error.issues[0].message },
      values,
    };
  }

  const result = await createProductUseCase(
    parseCreateProductFormData(formData),
    dependencies,
  );
  if (!result.success)
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
      values,
    };

  if (quantity.data > 0) {
    // Existing contracts persist separately. Never report full success or retain
    // a populated creation form after the product has already been saved.
    try {
      const stock = await adjustInitialStockUseCase(
        { productId: result.product.id, quantity: quantity.data },
        dependencies,
      );
      if (stock.success) {
        return {
          successMessage: "Produto cadastrado com sucesso.",
          values: createEmptyProductFormValues(),
        };
      }
    } catch {
      // A connection failure may have an unknown persistence outcome.
    }
    return {
      formError: `O produto "${result.product.name}" foi cadastrado, mas não foi possível confirmar a entrada inicial de ${quantity.data} unidades. Não cadastre novamente. Confira o saldo e o histórico em Estoque antes de registrar um ajuste.`,
      values: createEmptyProductFormValues(),
    };
  }

  return {
    successMessage: "Produto cadastrado com sucesso.",
    values: createEmptyProductFormValues(),
  };
}
