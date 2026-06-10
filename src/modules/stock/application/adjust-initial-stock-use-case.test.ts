import { describe, expect, it } from "vitest";

import type { StockMovement } from "../domain/stock-movement";
import { adjustInitialStockUseCase } from "./adjust-initial-stock-use-case";
import type {
  SaveStockMovementResult,
  StockMovementRepository,
} from "./stock-movement-repository";

class FakeStockMovementRepository implements StockMovementRepository {
  public listedProductId?: string;
  public savedMovement?: StockMovement;

  constructor(
    private readonly movements: StockMovement[] = [],
    private readonly saveResult?: SaveStockMovementResult,
  ) {}

  async listByProductId(productId: string): Promise<StockMovement[]> {
    this.listedProductId = productId;

    return this.movements;
  }

  async save(movement: StockMovement): Promise<SaveStockMovementResult> {
    this.savedMovement = movement;

    return (
      this.saveResult ?? {
        movement,
        success: true,
      }
    );
  }
}

describe("adjustInitialStockUseCase", () => {
  it("creates an initial stock movement and returns the new balance", async () => {
    const repository = new FakeStockMovementRepository([
      createMovement({ quantityChange: 2 }),
    ]);

    const result = await adjustInitialStockUseCase(
      {
        productId: " product-1 ",
        quantity: 10,
      },
      {
        generateStockMovementId: () => "movement-1",
        getCurrentDate: () => new Date("2026-06-10T12:00:00.000Z"),
        stockMovementRepository: repository,
      },
    );

    expect(result).toEqual({
      movement: {
        createdAt: new Date("2026-06-10T12:00:00.000Z"),
        id: "movement-1",
        productId: "product-1",
        quantityChange: 10,
        type: "initial_adjustment",
      },
      quantityOnHand: 12,
      success: true,
    });
    expect(repository.listedProductId).toBe("product-1");
    expect(repository.savedMovement).toEqual({
      createdAt: new Date("2026-06-10T12:00:00.000Z"),
      id: "movement-1",
      productId: "product-1",
      quantityChange: 10,
      type: "initial_adjustment",
    });
  });

  it("returns field errors when input is invalid", async () => {
    const repository = new FakeStockMovementRepository();

    const result = await adjustInitialStockUseCase(
      {
        productId: "",
        quantity: 0,
      },
      {
        generateStockMovementId: () => "movement-1",
        getCurrentDate: () => new Date("2026-06-10T12:00:00.000Z"),
        stockMovementRepository: repository,
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        productId: "Informe o produto.",
        quantity: "Informe uma quantidade maior que zero.",
      },
      success: false,
    });
    expect(repository.savedMovement).toBeUndefined();
  });

  it("maps persistence errors", async () => {
    const repository = new FakeStockMovementRepository([], {
      error: "unknown",
      success: false,
    });

    const result = await adjustInitialStockUseCase(
      {
        productId: "product-1",
        quantity: 10,
      },
      {
        generateStockMovementId: () => "movement-1",
        getCurrentDate: () => new Date("2026-06-10T12:00:00.000Z"),
        stockMovementRepository: repository,
      },
    );

    expect(result).toEqual({
      formError: "Nao foi possivel registrar a movimentacao de estoque.",
      success: false,
    });
  });
});

function createMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    id: "movement-existing",
    productId: "product-1",
    quantityChange: 1,
    type: "manual_adjustment",
    ...overrides,
  };
}
