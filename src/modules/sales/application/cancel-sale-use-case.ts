import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type { SaleCancellationRepository } from "./sale-cancellation-repository";
import type { SaleDetailRepository } from "./sale-detail-repository";

export type CancelSaleUseCaseResult =
  | {
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

export type CancelSaleDateProvider = () => Date;

type CancelSaleUseCaseDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  getCurrentDate: CancelSaleDateProvider;
  saleCancellationRepository: SaleCancellationRepository;
  saleDetailRepository: SaleDetailRepository;
};

export async function cancelSaleUseCase(
  input: { adminPassword?: string; saleId: string } | string,
  dependencies: CancelSaleUseCaseDependencies,
): Promise<CancelSaleUseCaseResult> {
  const saleIdInput = typeof input === "string" ? input : input.saleId;
  const adminPassword =
    typeof input === "string" ? undefined : input.adminPassword;
  const saleId = saleIdInput.trim();

  if (!saleId) {
    return {
      formError: "Venda nao encontrada.",
      success: false,
    };
  }

  const currentProfileResult =
    await dependencies.currentUserProfileRepository.getCurrent();

  if (!currentProfileResult.success) {
    return {
      formError:
        currentProfileResult.error === "unauthenticated"
          ? "Sessao expirada. Entre novamente."
          : "Nao foi possivel identificar o usuario atual.",
      success: false,
    };
  }

  if (
    currentProfileResult.profile.role !== "admin" &&
    currentProfileResult.profile.role !== "operator"
  ) {
    return {
      formError: "Usuario sem permissao para cancelar vendas.",
      success: false,
    };
  }

  const saleDetailResult =
    await dependencies.saleDetailRepository.findById(saleId);

  if (!saleDetailResult.success) {
    return {
      formError:
        saleDetailResult.error === "not_found"
          ? "Venda nao encontrada."
          : "Nao foi possivel carregar a venda.",
      success: false,
    };
  }

  if (saleDetailResult.sale.status === "canceled") {
    return {
      formError: "Venda ja cancelada.",
      success: false,
    };
  }

  const canceledAt = dependencies.getCurrentDate();
  const cancelResult = await dependencies.saleCancellationRepository.cancel({
    adminPassword,
    canceledAt,
    saleId: saleDetailResult.sale.id,
  });

  if (!cancelResult.success) {
    return {
      formError:
        cancelResult.error === "admin_password_required"
          ? "Informe a senha administrativa para cancelar a venda."
          : "Nao foi possivel cancelar a venda.",
      success: false,
    };
  }

  return {
    success: true,
  };
}
