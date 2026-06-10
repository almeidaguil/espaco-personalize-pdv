import type { StockMovement } from "../domain/stock-movement";

export type SaveStockMovementResult =
  | {
      movement: StockMovement;
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type StockMovementRepository = {
  listByProductId(productId: string): Promise<StockMovement[]>;
  save(movement: StockMovement): Promise<SaveStockMovementResult>;
};
