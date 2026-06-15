import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import type { StockMovementRepository } from "@/modules/stock/application/stock-movement-repository";
import { createStockMovement } from "@/modules/stock/domain/stock-movement";

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
export type CancelSaleStockMovementIdGenerator = () => string;

type CancelSaleUseCaseDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  generateStockMovementId: CancelSaleStockMovementIdGenerator;
  getCurrentDate: CancelSaleDateProvider;
  saleCancellationRepository: SaleCancellationRepository;
  saleDetailRepository: SaleDetailRepository;
  stockMovementRepository: StockMovementRepository;
};

export async function cancelSaleUseCase(
  saleIdInput: string,
  dependencies: CancelSaleUseCaseDependencies,
): Promise<CancelSaleUseCaseResult> {
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
    canceledAt,
    saleId: saleDetailResult.sale.id,
  });

  if (!cancelResult.success) {
    return {
      formError: "Nao foi possivel cancelar a venda.",
      success: false,
    };
  }

  for (const item of saleDetailResult.sale.items) {
    const movementResult = createStockMovement({
      createdAt: canceledAt,
      id: dependencies.generateStockMovementId(),
      productId: item.productId,
      quantityChange: item.quantity,
      saleId: saleDetailResult.sale.id,
      type: "sale_cancellation",
    });

    if (!movementResult.success) {
      return {
        formError: "Nao foi possivel gerar a devolucao de estoque.",
        success: false,
      };
    }

    const saveMovementResult = await dependencies.stockMovementRepository.save(
      movementResult.movement,
    );

    if (!saveMovementResult.success) {
      return {
        formError: "Nao foi possivel devolver o estoque da venda.",
        success: false,
      };
    }
  }

  return {
    success: true,
  };
}
