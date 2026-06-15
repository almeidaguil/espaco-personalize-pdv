import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import type { StockMovementRepository } from "@/modules/stock/application/stock-movement-repository";

import {
  cancelSaleUseCase,
  type CancelSaleDateProvider,
  type CancelSaleStockMovementIdGenerator,
} from "../application/cancel-sale-use-case";
import type { SaleCancellationRepository } from "../application/sale-cancellation-repository";
import type { SaleDetailRepository } from "../application/sale-detail-repository";
import type { CancelSaleActionState } from "./cancel-sale-action-state";
import { parseCancelSaleFormData } from "./cancel-sale-form-data";

type CancelSaleActionServiceDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  generateStockMovementId: CancelSaleStockMovementIdGenerator;
  getCurrentDate: CancelSaleDateProvider;
  saleCancellationRepository: SaleCancellationRepository;
  saleDetailRepository: SaleDetailRepository;
  stockMovementRepository: StockMovementRepository;
};

export async function cancelSaleActionService(
  _previousState: CancelSaleActionState,
  formData: FormData,
  dependencies: CancelSaleActionServiceDependencies,
): Promise<CancelSaleActionState> {
  const result = await cancelSaleUseCase(
    parseCancelSaleFormData(formData),
    dependencies,
  );

  if (!result.success) {
    return {
      formError: result.formError,
    };
  }

  return {
    successMessage: "Venda cancelada com sucesso.",
  };
}
