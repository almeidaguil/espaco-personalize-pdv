import { describe, expect, it } from "vitest";

import type {
  FindProductByIdResult,
  ProductRepository,
} from "@/modules/products/application/product-repository";
import { Money } from "@/modules/products/domain/money";
import type { Product } from "@/modules/products/domain/product";

import type { StockMovement } from "../domain/stock-movement";
import type { StockMovementRepository } from "./stock-movement-repository";
import { listStockMovementsSummaryUseCase } from "./list-stock-movements-summary-use-case";

class FakeProductRepository implements ProductRepository {
  constructor(private readonly products: Product[]) {}

  async findById(): Promise<FindProductByIdResult> {
    return {
      error: "not_found",
      success: false,
    };
  }

  async list() {
    return {
      products: this.products,
      success: true as const,
    };
  }

  async save(product: Product) {
    return {
      product,
      success: true as const,
    };
  }

  async update(product: Product) {
    return {
      product,
      success: true as const,
    };
  }
}

class FailingProductRepository implements ProductRepository {
  async findById() {
    return {
      error: "not_found" as const,
      success: false as const,
    };
  }

  async list() {
    return {
      error: "unknown" as const,
      success: false as const,
    };
  }

  async save() {
    return {
      error: "unknown" as const,
      success: false as const,
    };
  }

  async update() {
    return {
      error: "unknown" as const,
      success: false as const,
    };
  }
}

class FakeStockMovementRepository implements StockMovementRepository {
  constructor(private readonly movements: StockMovement[]) {}

  async listAll(): Promise<StockMovement[]> {
    return this.movements;
  }

  async listByProductId(productId: string): Promise<StockMovement[]> {
    return this.movements.filter(
      (movement) => movement.productId === productId,
    );
  }

  async save(movement: StockMovement) {
    return {
      movement,
      success: true as const,
    };
  }
}

describe("listStockMovementsSummaryUseCase", () => {
  it("builds movement history and product balances", async () => {
    const result = await listStockMovementsSummaryUseCase({
      productRepository: new FakeProductRepository([
        createProduct({
          id: "product-1",
          name: "Caneca personalizada",
          sku: "CANECA-001",
        }),
        createProduct({
          id: "product-2",
          name: "Chaveiro",
        }),
      ]),
      stockMovementRepository: new FakeStockMovementRepository([
        createMovement({
          id: "movement-1",
          productId: "product-1",
          quantityChange: 10,
        }),
        createMovement({
          id: "movement-2",
          productId: "product-1",
          quantityChange: -3,
          type: "manual_adjustment",
        }),
      ]),
    });

    expect(result).toEqual({
      balances: [
        {
          productId: "product-1",
          productLabel: "Caneca personalizada (CANECA-001)",
          quantityOnHand: 7,
        },
      ],
      movements: [
        {
          createdAt: new Date("2026-06-10T12:00:00.000Z"),
          id: "movement-1",
          productId: "product-1",
          productLabel: "Caneca personalizada (CANECA-001)",
          quantityChange: 10,
          type: "initial_adjustment",
        },
        {
          createdAt: new Date("2026-06-10T12:00:00.000Z"),
          id: "movement-2",
          productId: "product-1",
          productLabel: "Caneca personalizada (CANECA-001)",
          quantityChange: -3,
          type: "manual_adjustment",
        },
      ],
      success: true,
    });
  });

  it("maps missing products in movement history", async () => {
    const result = await listStockMovementsSummaryUseCase({
      productRepository: new FakeProductRepository([]),
      stockMovementRepository: new FakeStockMovementRepository([
        createMovement({ productId: "removed-product" }),
      ]),
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.movements[0]?.productLabel).toBe("Produto removido");
    }
  });

  it("returns an error when products cannot be loaded", async () => {
    await expect(
      listStockMovementsSummaryUseCase({
        productRepository: new FailingProductRepository(),
        stockMovementRepository: new FakeStockMovementRepository([]),
      }),
    ).resolves.toEqual({
      formError: "Nao foi possivel carregar os produtos.",
      success: false,
    });
  });
});

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    isActive: true,
    name: "Produto",
    price: Money.fromReais(10),
    ...overrides,
  };
}

function createMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    id: "movement-1",
    productId: "product-1",
    quantityChange: 10,
    type: "initial_adjustment",
    ...overrides,
  };
}
