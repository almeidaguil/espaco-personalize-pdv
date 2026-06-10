import type { StockMovement } from "./stock-movement";

export type StockBalanceValidationError = {
  message: string;
};

export type ApplyStockMovementResult =
  | {
      quantityOnHand: number;
      success: true;
    }
  | {
      errors: StockBalanceValidationError[];
      success: false;
    };

export function calculateStockBalance(movements: StockMovement[]): number {
  return movements.reduce(
    (quantityOnHand, movement) => quantityOnHand + movement.quantityChange,
    0,
  );
}

export function applyStockMovement(
  currentQuantityOnHand: number,
  movement: StockMovement,
): ApplyStockMovementResult {
  if (!Number.isInteger(currentQuantityOnHand)) {
    return {
      errors: [{ message: "Current stock quantity must be an integer." }],
      success: false,
    };
  }

  const quantityOnHand = currentQuantityOnHand + movement.quantityChange;

  if (quantityOnHand < 0) {
    return {
      errors: [{ message: "Stock cannot become negative." }],
      success: false,
    };
  }

  return {
    quantityOnHand,
    success: true,
  };
}
