import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  ListOpenCashSessionsResult,
  SaveCashSessionResult,
} from "@/modules/cash/application/cash-session-repository";
import type { CashSession } from "@/modules/cash/domain/cash-session";
import type {
  ListProductsResult,
  ProductRepository,
  SaveProductResult,
} from "@/modules/products/application/product-repository";
import { Money } from "@/modules/products/domain/money";
import type { Product } from "@/modules/products/domain/product";
import type {
  SaveStockMovementResult,
  StockMovementRepository,
} from "@/modules/stock/application/stock-movement-repository";
import type { StockMovement } from "@/modules/stock/domain/stock-movement";

import { createSaleUseCase } from "./create-sale-use-case";
import type { SaleRepository, SaveSaleResult } from "./sale-repository";
import type { Sale } from "../domain/sale";

class FakeCashSessionRepository implements CashSessionRepository {
  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: createCashSession(),
      success: true,
    },
  ) {}

  async findOpenByIdAndOperator(): Promise<FindOpenCashSessionResult> {
    return this.findResult;
  }

  async findOpenByEventAndOperator(): Promise<FindOpenCashSessionResult> {
    return {
      session: null,
      success: true,
    };
  }

  async listOpenByOperator(): Promise<ListOpenCashSessionsResult> {
    return {
      sessions: [],
      success: true,
    };
  }

  async save(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }

  async update(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }
}

class FakeProductRepository implements ProductRepository {
  constructor(
    private readonly result: ListProductsResult = {
      products: [createProduct()],
      success: true,
    },
  ) {}

  async list(): Promise<ListProductsResult> {
    return this.result;
  }

  async save(product: Product): Promise<SaveProductResult> {
    return {
      product,
      success: true,
    };
  }
}

class FakeStockMovementRepository implements StockMovementRepository {
  constructor(private readonly movements: StockMovement[] = []) {}

  async listAll(): Promise<StockMovement[]> {
    return this.movements;
  }

  async listByProductId(productId: string): Promise<StockMovement[]> {
    return this.movements.filter(
      (movement) => movement.productId === productId,
    );
  }

  async save(movement: StockMovement): Promise<SaveStockMovementResult> {
    return {
      movement,
      success: true,
    };
  }
}

class FakeSaleRepository implements SaleRepository {
  public savedSale?: Sale;

  constructor(private readonly result?: SaveSaleResult) {}

  async save(sale: Sale): Promise<SaveSaleResult> {
    this.savedSale = sale;

    return (
      this.result ?? {
        sale,
        success: true,
      }
    );
  }
}

describe("createSaleUseCase", () => {
  it("creates a sale using trusted product data and available stock", async () => {
    const saleRepository = new FakeSaleRepository();
    const stockMovementRepository = new FakeStockMovementRepository([
      createStockMovement(3),
    ]);

    const result = await createSaleUseCase(createInput(), {
      cashSessionRepository: new FakeCashSessionRepository(),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository,
      stockMovementRepository,
    });

    expect(result.success).toBe(true);
    expect(saleRepository.savedSale).toMatchObject({
      cashSessionId: "cash-session-1",
      eventId: "event-1",
      id: "sale-1",
      items: [
        {
          productId: "product-1",
          productName: "Chaveiro Polvo",
          quantity: 2,
          totalInReais: 30,
          unitPriceInReais: 15,
        },
      ],
      payment: {
        amountInReais: 50,
        changeInReais: 20,
        method: "cash",
      },
      totalInReais: 30,
    });
    await expect(
      stockMovementRepository.listByProductId("product-1"),
    ).resolves.toHaveLength(1);
  });

  it("rejects sales when there is no open cash session", async () => {
    const result = await createSaleUseCase(createInput(), {
      cashSessionRepository: new FakeCashSessionRepository({
        session: null,
        success: true,
      }),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository: new FakeSaleRepository(),
      stockMovementRepository: new FakeStockMovementRepository([
        createStockMovement(3),
      ]),
    });

    expect(result).toEqual({
      formError: "Nao ha caixa aberto para esta venda.",
      success: false,
    });
  });

  it("rejects sales when the cash session belongs to another event", async () => {
    const result = await createSaleUseCase(createInput(), {
      cashSessionRepository: new FakeCashSessionRepository({
        session: {
          ...createCashSession(),
          eventId: "event-2",
        },
        success: true,
      }),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository: new FakeSaleRepository(),
      stockMovementRepository: new FakeStockMovementRepository([
        createStockMovement(3),
      ]),
    });

    expect(result).toEqual({
      formError: "O caixa aberto nao pertence ao evento informado.",
      success: false,
    });
  });

  it("rejects inactive products", async () => {
    const result = await createSaleUseCase(createInput(), {
      cashSessionRepository: new FakeCashSessionRepository(),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository({
        products: [{ ...createProduct(), isActive: false }],
        success: true,
      }),
      saleRepository: new FakeSaleRepository(),
      stockMovementRepository: new FakeStockMovementRepository([
        createStockMovement(3),
      ]),
    });

    expect(result).toEqual({
      formError: "Produto indisponivel para venda.",
      success: false,
    });
  });

  it("rejects sales with insufficient stock", async () => {
    const result = await createSaleUseCase(createInput(), {
      cashSessionRepository: new FakeCashSessionRepository(),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository: new FakeSaleRepository(),
      stockMovementRepository: new FakeStockMovementRepository([
        createStockMovement(1),
      ]),
    });

    expect(result).toEqual({
      formError: "Estoque insuficiente para Chaveiro Polvo (CHAVEIRO-001).",
      success: false,
    });
  });

  it("rejects insufficient payments", async () => {
    const result = await createSaleUseCase(
      {
        ...createInput(),
        payment: {
          amountInReais: 10,
          method: "cash",
        },
      },
      {
        cashSessionRepository: new FakeCashSessionRepository(),
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        generateSaleId: () => "sale-1",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
        productRepository: new FakeProductRepository(),
        saleRepository: new FakeSaleRepository(),
        stockMovementRepository: new FakeStockMovementRepository([
          createStockMovement(3),
        ]),
      },
    );

    expect(result).toEqual({
      formError: "Payment amount must cover the sale total.",
      success: false,
    });
  });
});

function createInput() {
  return {
    cashSessionId: "cash-session-1",
    eventId: "event-1",
    items: [
      {
        productId: "product-1",
        quantity: 2,
      },
    ],
    payment: {
      amountInReais: 50,
      method: "cash",
    },
  };
}

function createCurrentUserProfileRepository(): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile: {
        id: "operator-1",
        role: "operator",
      },
      success: true,
    }),
  };
}

function createCashSession(): CashSession {
  return {
    eventId: "event-1",
    id: "cash-session-1",
    openedAt: new Date("2026-07-10T09:00:00.000Z"),
    openingAmountInReais: 150.5,
    operatorId: "operator-1",
    status: "open",
  };
}

function createProduct(): Product {
  return {
    id: "product-1",
    isActive: true,
    name: "Chaveiro Polvo",
    price: Money.fromReais(15),
    sku: "CHAVEIRO-001",
  };
}

function createStockMovement(quantityChange: number): StockMovement {
  return {
    createdAt: new Date("2026-07-10T09:00:00.000Z"),
    id: `stock-movement-${quantityChange}`,
    productId: "product-1",
    quantityChange,
    type: "manual_adjustment",
  };
}
