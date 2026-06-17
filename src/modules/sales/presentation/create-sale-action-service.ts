import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import type { CashSessionRepository } from "@/modules/cash/application/cash-session-repository";
import type { ProductRepository } from "@/modules/products/application/product-repository";
import type { StockMovementRepository } from "@/modules/stock/application/stock-movement-repository";
import {
  logServerError,
  shouldLogUnexpectedActionError,
} from "@/shared/lib/server-logger";

import {
  createSaleUseCase,
  type SaleDateProvider,
  type SaleIdGenerator,
} from "../application/create-sale-use-case";
import type { SaleRepository } from "../application/sale-repository";
import { parseCreateSaleFormData } from "./sale-form-data";
import type { SaleActionState } from "./sale-action-state";

type CreateSaleActionServiceDependencies = {
  cashSessionRepository: CashSessionRepository;
  currentUserProfileRepository: CurrentUserProfileRepository;
  generateSaleId: SaleIdGenerator;
  getCurrentDate: SaleDateProvider;
  productRepository: ProductRepository;
  saleRepository: SaleRepository;
  stockMovementRepository: StockMovementRepository;
};

export async function createSaleActionService(
  _previousState: SaleActionState,
  formData: FormData,
  dependencies: CreateSaleActionServiceDependencies,
): Promise<SaleActionState> {
  const result = await createSaleUseCase(
    parseCreateSaleFormData(formData),
    dependencies,
  );

  if (!result.success) {
    if (shouldLogUnexpectedActionError(result.formError)) {
      logServerError("sale.create.failed", {
        formError: result.formError,
        operation: "create-sale",
      });
    }

    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }

  return {
    successMessage: "Venda finalizada com sucesso.",
  };
}
