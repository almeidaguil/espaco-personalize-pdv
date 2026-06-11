import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type { StockMovement } from "../domain/stock-movement";
import type { StockMovementRepository } from "../application/stock-movement-repository";
import { adjustStockActionService } from "./adjust-stock-action-service";

class FakeStockMovementRepository implements StockMovementRepository {
  public savedMovement?: StockMovement;

  constructor(private readonly movements: StockMovement[] = []) {}

  async listAll(): Promise<StockMovement[]> {
    return this.movements;
  }

  async listByProductId(): Promise<StockMovement[]> {
    return this.movements;
  }

  async save(movement: StockMovement) {
    this.savedMovement = movement;

    return {
      movement,
      success: true as const,
    };
  }
}

describe("adjustStockActionService", () => {
  it("creates a stock adjustment for admin users", async () => {
    const stockMovementRepository = new FakeStockMovementRepository();

    const result = await adjustStockActionService(
      {},
      createFormData({
        productId: "product-1",
        quantity: "8",
        type: "initial_adjustment",
      }),
      {
        currentUserProfileRepository:
          createCurrentUserProfileRepository("admin"),
        generateStockMovementId: () => "movement-1",
        getCurrentDate: () => new Date("2026-06-10T12:00:00.000Z"),
        stockMovementRepository,
      },
    );

    expect(result).toEqual({
      successMessage: "Estoque ajustado com sucesso.",
    });
    expect(stockMovementRepository.savedMovement).toEqual({
      createdAt: new Date("2026-06-10T12:00:00.000Z"),
      id: "movement-1",
      productId: "product-1",
      quantityChange: 8,
      type: "initial_adjustment",
    });
  });

  it("creates manual adjustments", async () => {
    const stockMovementRepository = new FakeStockMovementRepository([
      createMovement({ quantityChange: 8 }),
    ]);

    const result = await adjustStockActionService(
      {},
      createFormData({
        productId: "product-1",
        quantity: "-2",
        type: "manual_adjustment",
      }),
      {
        currentUserProfileRepository:
          createCurrentUserProfileRepository("admin"),
        generateStockMovementId: () => "movement-1",
        getCurrentDate: () => new Date("2026-06-10T12:00:00.000Z"),
        stockMovementRepository,
      },
    );

    expect(result).toEqual({
      successMessage: "Estoque ajustado com sucesso.",
    });
    expect(stockMovementRepository.savedMovement?.type).toBe(
      "manual_adjustment",
    );
    expect(stockMovementRepository.savedMovement?.quantityChange).toBe(-2);
  });

  it("blocks operator users before changing stock", async () => {
    const stockMovementRepository = new FakeStockMovementRepository();

    const result = await adjustStockActionService(
      {},
      createFormData({
        productId: "product-1",
        quantity: "8",
        type: "initial_adjustment",
      }),
      {
        currentUserProfileRepository:
          createCurrentUserProfileRepository("operator"),
        generateStockMovementId: () => "movement-1",
        getCurrentDate: () => new Date("2026-06-10T12:00:00.000Z"),
        stockMovementRepository,
      },
    );

    expect(result).toEqual({
      formError: "Acesso restrito a administradores.",
    });
    expect(stockMovementRepository.savedMovement).toBeUndefined();
  });

  it("returns field errors from stock validation", async () => {
    const result = await adjustStockActionService(
      {},
      createFormData({
        productId: "",
        quantity: "0",
        type: "initial_adjustment",
      }),
      {
        currentUserProfileRepository:
          createCurrentUserProfileRepository("admin"),
        generateStockMovementId: () => "movement-1",
        getCurrentDate: () => new Date("2026-06-10T12:00:00.000Z"),
        stockMovementRepository: new FakeStockMovementRepository(),
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        productId: "Informe o produto.",
        quantity: "Informe uma quantidade maior que zero.",
        type: undefined,
      },
      formError: undefined,
    });
  });
});

function createCurrentUserProfileRepository(
  role: "admin" | "operator",
): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile: {
        id: "user-1",
        role,
      },
      success: true,
    }),
  };
}

function createFormData(input: {
  productId: string;
  quantity: string;
  type: "initial_adjustment" | "manual_adjustment";
}): FormData {
  const formData = new FormData();
  formData.set("productId", input.productId);
  formData.set("quantity", input.quantity);
  formData.set("type", input.type);

  return formData;
}

function createMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    createdAt: new Date("2026-06-10T11:00:00.000Z"),
    id: "existing-movement-1",
    productId: "product-1",
    quantityChange: 8,
    type: "initial_adjustment",
    ...overrides,
  };
}
