import { describe, expect, it } from "vitest";

import type { StockMovement } from "../domain/stock-movement";
import type { StockMovementRepository } from "./stock-movement-repository";
import { adjustStockUseCase } from "./adjust-stock-use-case";

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

describe("adjustStockUseCase", () => {
  it("creates initial stock adjustments", async () => {
    const repository = new FakeStockMovementRepository();

    const result = await adjustStockUseCase(
      {
        productId: "product-1",
        quantity: 10,
        type: "initial_adjustment",
      },
      createDependencies(repository),
    );

    expect(result).toEqual({
      movement: {
        createdAt: new Date("2026-06-10T12:00:00.000Z"),
        id: "movement-1",
        productId: "product-1",
        quantityChange: 10,
        type: "initial_adjustment",
      },
      quantityOnHand: 10,
      success: true,
    });
  });

  it.each([
    [5, 15],
    [-3, 7],
    [-10, 0],
  ])(
    "applies manual adjustment %s with balance %s",
    async (quantity, balance) => {
      const repository = new FakeStockMovementRepository([
        createMovement({ quantityChange: 10 }),
      ]);

      const result = await adjustStockUseCase(
        {
          productId: "product-1",
          quantity,
          type: "manual_adjustment",
        },
        createDependencies(repository),
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.quantityOnHand).toBe(balance);
        expect(result.movement.type).toBe("manual_adjustment");
        expect(result.movement.quantityChange).toBe(quantity);
        expect(repository.savedMovement).toEqual(result.movement);
      }
    },
  );

  it.each([1.5, Number.NaN, "abc"])(
    "rejects invalid manual quantity %s",
    async (quantity) => {
      const repository = new FakeStockMovementRepository();
      const result = await adjustStockUseCase(
        { productId: "product-1", quantity, type: "manual_adjustment" },
        createDependencies(repository),
      );
      expect(result.success).toBe(false);
      expect(repository.savedMovement).toBeUndefined();
    },
  );

  it("prevents manual adjustments from making stock negative", async () => {
    const repository = new FakeStockMovementRepository([
      createMovement({ quantityChange: 2 }),
    ]);

    await expect(
      adjustStockUseCase(
        {
          productId: "product-1",
          quantity: -3,
          type: "manual_adjustment",
        },
        createDependencies(repository),
      ),
    ).resolves.toEqual({
      formError: "Estoque nao pode ficar negativo.",
      success: false,
    });
  });

  it("rejects zero manual adjustments", async () => {
    await expect(
      adjustStockUseCase(
        {
          productId: "product-1",
          quantity: 0,
          type: "manual_adjustment",
        },
        createDependencies(new FakeStockMovementRepository()),
      ),
    ).resolves.toEqual({
      fieldErrors: {
        productId: undefined,
        quantity: "Informe uma quantidade diferente de zero.",
        type: undefined,
      },
      success: false,
    });
  });
});

function createDependencies(repository: StockMovementRepository) {
  return {
    generateStockMovementId: () => "movement-1",
    getCurrentDate: () => new Date("2026-06-10T12:00:00.000Z"),
    stockMovementRepository: repository,
  };
}

function createMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    createdAt: new Date("2026-06-10T11:00:00.000Z"),
    id: "existing-movement-1",
    productId: "product-1",
    quantityChange: 10,
    type: "initial_adjustment",
    ...overrides,
  };
}
