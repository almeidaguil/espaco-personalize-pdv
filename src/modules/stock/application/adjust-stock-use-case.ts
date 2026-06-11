import {
  applyStockMovement,
  calculateStockBalance,
} from "../domain/stock-balance";
import {
  createStockMovement,
  type StockMovement,
} from "../domain/stock-movement";
import type { StockMovementRepository } from "./stock-movement-repository";
import { adjustStockSchema } from "./stock-validation";

export type StockMovementIdGenerator = () => string;
export type StockMovementDateProvider = () => Date;

export type AdjustStockUseCaseResult =
  | {
      movement: StockMovement;
      quantityOnHand: number;
      success: true;
    }
  | {
      fieldErrors?: Partial<Record<"productId" | "quantity" | "type", string>>;
      formError?: string;
      success: false;
    };

type AdjustStockUseCaseDependencies = {
  generateStockMovementId: StockMovementIdGenerator;
  getCurrentDate: StockMovementDateProvider;
  stockMovementRepository: StockMovementRepository;
};

export async function adjustStockUseCase(
  input: unknown,
  dependencies: AdjustStockUseCaseDependencies,
): Promise<AdjustStockUseCaseResult> {
  const parsedInput = adjustStockSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        productId: flattenedErrors.productId?.[0],
        quantity: flattenedErrors.quantity?.[0],
        type: flattenedErrors.type?.[0],
      },
      success: false,
    };
  }

  const currentMovements =
    await dependencies.stockMovementRepository.listByProductId(
      parsedInput.data.productId,
    );
  const currentQuantityOnHand = calculateStockBalance(currentMovements);
  const movementResult = createStockMovement({
    createdAt: dependencies.getCurrentDate(),
    id: dependencies.generateStockMovementId(),
    productId: parsedInput.data.productId,
    quantityChange: parsedInput.data.quantity,
    type: parsedInput.data.type,
  });

  if (!movementResult.success) {
    return {
      formError:
        movementResult.errors[0]?.message ??
        "Movimentacao de estoque invalida.",
      success: false,
    };
  }

  const balanceResult = applyStockMovement(
    currentQuantityOnHand,
    movementResult.movement,
  );

  if (!balanceResult.success) {
    return {
      formError: mapStockBalanceError(balanceResult.errors[0]?.message),
      success: false,
    };
  }

  const saveResult = await dependencies.stockMovementRepository.save(
    movementResult.movement,
  );

  if (!saveResult.success) {
    return {
      formError: "Nao foi possivel registrar a movimentacao de estoque.",
      success: false,
    };
  }

  return {
    movement: saveResult.movement,
    quantityOnHand: balanceResult.quantityOnHand,
    success: true,
  };
}

function mapStockBalanceError(message: string | undefined): string {
  if (message === "Stock cannot become negative.") {
    return "Estoque nao pode ficar negativo.";
  }

  return "Estoque invalido.";
}
