export type StockMovementType =
  | "initial_adjustment"
  | "manual_adjustment"
  | "sale";

export type StockMovement = {
  createdAt: Date;
  id: string;
  productId: string;
  quantityChange: number;
  saleId?: string;
  type: StockMovementType;
};

export type CreateStockMovementInput = {
  createdAt: Date;
  id: string;
  productId: string;
  quantityChange: number;
  saleId?: string;
  type: StockMovementType;
};

export type StockMovementValidationError = {
  field: "createdAt" | "id" | "productId" | "quantityChange" | "saleId";
  message: string;
};

export type CreateStockMovementResult =
  | {
      movement: StockMovement;
      success: true;
    }
  | {
      errors: StockMovementValidationError[];
      success: false;
    };

export function createStockMovement(
  input: CreateStockMovementInput,
): CreateStockMovementResult {
  const errors: StockMovementValidationError[] = [];
  const id = input.id.trim();
  const productId = input.productId.trim();
  const saleId = input.saleId?.trim();

  if (!id) {
    errors.push({
      field: "id",
      message: "Stock movement id is required.",
    });
  }

  if (!productId) {
    errors.push({
      field: "productId",
      message: "Product id is required.",
    });
  }

  if (!Number.isInteger(input.quantityChange)) {
    errors.push({
      field: "quantityChange",
      message: "Stock movement quantity must be an integer.",
    });
  }

  if (input.quantityChange === 0) {
    errors.push({
      field: "quantityChange",
      message: "Stock movement quantity cannot be zero.",
    });
  }

  if (input.type === "sale") {
    if (!saleId) {
      errors.push({
        field: "saleId",
        message: "Sale stock movements must reference a sale.",
      });
    }

    if (input.quantityChange >= 0) {
      errors.push({
        field: "quantityChange",
        message: "Sale stock movements must decrease stock.",
      });
    }
  }

  if (input.type !== "sale" && saleId) {
    errors.push({
      field: "saleId",
      message: "Only sale stock movements can reference a sale.",
    });
  }

  if (!isValidMovementDate(input.createdAt)) {
    errors.push({
      field: "createdAt",
      message: "Stock movement date must be valid.",
    });
  }

  if (errors.length > 0) {
    return {
      errors,
      success: false,
    };
  }

  return {
    movement: {
      createdAt: new Date(input.createdAt),
      id,
      productId,
      quantityChange: input.quantityChange,
      ...(saleId ? { saleId } : {}),
      type: input.type,
    },
    success: true,
  };
}

function isValidMovementDate(date: Date): boolean {
  return date instanceof Date && Number.isFinite(date.getTime());
}
