import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import { requireAdminUseCase } from "@/modules/auth/application/require-admin-use-case";

import {
  adjustStockUseCase,
  type StockMovementDateProvider,
  type StockMovementIdGenerator,
} from "../application/adjust-stock-use-case";
import type { StockMovementRepository } from "../application/stock-movement-repository";
import type { StockAdjustmentActionState } from "./stock-adjustment-action-state";
import { parseStockAdjustmentFormData } from "./stock-adjustment-form-data";

type AdjustStockActionServiceDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  generateStockMovementId: StockMovementIdGenerator;
  getCurrentDate: StockMovementDateProvider;
  stockMovementRepository: StockMovementRepository;
};

export async function adjustStockActionService(
  _previousState: StockAdjustmentActionState,
  formData: FormData,
  dependencies: AdjustStockActionServiceDependencies,
): Promise<StockAdjustmentActionState> {
  const authorizationResult = await requireAdminUseCase(
    dependencies.currentUserProfileRepository,
  );

  if (!authorizationResult.success) {
    return {
      formError: authorizationResult.formError,
    };
  }

  const result = await adjustStockUseCase(
    parseStockAdjustmentFormData(formData),
    {
      generateStockMovementId: dependencies.generateStockMovementId,
      getCurrentDate: dependencies.getCurrentDate,
      stockMovementRepository: dependencies.stockMovementRepository,
    },
  );

  if (!result.success) {
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }

  return {
    successMessage: "Estoque ajustado com sucesso.",
  };
}
