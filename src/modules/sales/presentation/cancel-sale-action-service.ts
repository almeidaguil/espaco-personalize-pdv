import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import {
  cancelSaleUseCase,
  type CancelSaleDateProvider,
} from "../application/cancel-sale-use-case";
import type { SaleCancellationRepository } from "../application/sale-cancellation-repository";
import type { SaleDetailRepository } from "../application/sale-detail-repository";
import type { CancelSaleActionState } from "./cancel-sale-action-state";
import { parseCancelSaleFormData } from "./cancel-sale-form-data";

type CancelSaleActionServiceDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  getCurrentDate: CancelSaleDateProvider;
  saleCancellationRepository: SaleCancellationRepository;
  saleDetailRepository: SaleDetailRepository;
};

export async function cancelSaleActionService(
  _previousState: CancelSaleActionState,
  formData: FormData,
  dependencies: CancelSaleActionServiceDependencies,
): Promise<CancelSaleActionState> {
  const input = parseCancelSaleFormData(formData);

  if (!input.confirmCancellation) {
    return {
      formError: "Confirme o cancelamento antes de continuar.",
    };
  }

  const result = await cancelSaleUseCase(
    {
      adminPassword: input.adminPassword,
      saleId: input.saleId,
    },
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
