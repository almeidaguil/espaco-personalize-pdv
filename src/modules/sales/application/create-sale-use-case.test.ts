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
  FindProductByIdResult,
  ListProductsResult,
  ProductRepository,
  SaveProductResult,
  UpdateProductResult,
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
  public findOperatorId?: string;

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: createCashSession(),
      success: true,
    },
  ) {}

  async findOpenByIdAndOperator(_input: {
    cashSessionId: string;
    operatorId: string;
  }): Promise<FindOpenCashSessionResult> {
    void _input;

    return {
      session: null,
      success: true,
    };
  }

  async findOpenByOperator(
    operatorId: string,
  ): Promise<FindOpenCashSessionResult> {
    this.findOperatorId = operatorId;

    return this.findResult;
  }

  async listOpenByOperator(
    _operatorId: string,
  ): Promise<ListOpenCashSessionsResult> {
    void _operatorId;
    return {
      sessions: [],
      success: true,
    };
  }

  async open(_input: {
    openingAmountInReais: number;
  }): Promise<SaveCashSessionResult> {
    void _input;
    return {
      session: createCashSession(),
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
  public listCalls = 0;
  constructor(
    private readonly result: ListProductsResult = {
      products: [createProduct()],
      success: true,
    },
  ) {}

  async findById(): Promise<FindProductByIdResult> {
    return {
      error: "not_found",
      success: false,
    };
  }

  async list(): Promise<ListProductsResult> {
    this.listCalls += 1;
    return this.result;
  }

  async save(product: Product): Promise<SaveProductResult> {
    return {
      product,
      success: true,
    };
  }

  async update(product: Product): Promise<UpdateProductResult> {
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
  it("finds the current operator cash session and uses it for the sale", async () => {
    const saleRepository = new FakeSaleRepository();
    const cashSessionRepository = new FakeCashSessionRepository();
    const stockMovementRepository = new FakeStockMovementRepository([
      createStockMovement(3),
    ]);

    const result = await createSaleUseCase(createInput(), {
      cashSessionRepository,
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository,
      stockMovementRepository,
    });

    expect(result.success).toBe(true);
    expect(cashSessionRepository.findOperatorId).toBe("operator-1");
    expect(saleRepository.savedSale).toMatchObject({
      cashSessionId: "cash-session-current",
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
    const productRepository = new FakeProductRepository();
    const result = await createSaleUseCase(createInput(), {
      cashSessionRepository: new FakeCashSessionRepository({
        session: null,
        success: true,
      }),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository,
      saleRepository: new FakeSaleRepository(),
      stockMovementRepository: new FakeStockMovementRepository([
        createStockMovement(3),
      ]),
    });

    expect(result).toEqual({
      formError: "Nao ha caixa aberto para esta venda.",
      success: false,
    });
    expect(productRepository.listCalls).toBe(0);
  });

  it("asks the operator to reopen the cash when the trusted session closes before persistence", async () => {
    const saleRepository = new FakeSaleRepository({
      error: "cash_session_closed",
      success: false,
    });
    const result = await createSaleUseCase(createInput(), {
      cashSessionRepository: new FakeCashSessionRepository(),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository,
      stockMovementRepository: new FakeStockMovementRepository([
        createStockMovement(3),
      ]),
    });

    expect(result).toEqual({
      formError:
        "O caixa foi fechado durante a venda. Abra um novo caixa e tente novamente.",
      success: false,
    });
    expect(saleRepository.savedSale?.cashSessionId).toBe(
      "cash-session-current",
    );
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

  it("accepts pix payments when the amount matches the total", async () => {
    const saleRepository = new FakeSaleRepository();

    const result = await createSaleUseCase(
      {
        ...createInput(),
        payment: {
          amountInReais: 30,
          method: "pix",
        },
      },
      {
        cashSessionRepository: new FakeCashSessionRepository(),
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        generateSaleId: () => "sale-1",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
        productRepository: new FakeProductRepository(),
        saleRepository,
        stockMovementRepository: new FakeStockMovementRepository([
          createStockMovement(3),
        ]),
      },
    );

    expect(result.success).toBe(true);
    expect(saleRepository.savedSale?.payment).toEqual({
      amountInReais: 30,
      changeInReais: 0,
      method: "pix",
    });
  });
});

function createInput() {
  return {
    cashSessionId: "forged-cash-session",
    items: [
      {
        productId: "product-1",
        quantity: 2,
      },
    ],
    payment: {
      amountInReais: 50,
      method: "cash" as const,
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
    id: "cash-session-current",
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
