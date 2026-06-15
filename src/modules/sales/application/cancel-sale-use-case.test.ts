import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import type {
  SaveStockMovementResult,
  StockMovementRepository,
} from "@/modules/stock/application/stock-movement-repository";
import type { StockMovement } from "@/modules/stock/domain/stock-movement";

import { cancelSaleUseCase } from "./cancel-sale-use-case";
import type {
  CancelSaleInput,
  CancelSaleResult,
  SaleCancellationRepository,
} from "./sale-cancellation-repository";
import type {
  GetSaleDetailResult,
  SaleDetail,
  SaleDetailRepository,
} from "./sale-detail-repository";

class FakeSaleDetailRepository implements SaleDetailRepository {
  public receivedId?: string;

  constructor(private readonly result: GetSaleDetailResult) {}

  async findById(id: string): Promise<GetSaleDetailResult> {
    this.receivedId = id;

    return this.result;
  }
}

class FakeSaleCancellationRepository implements SaleCancellationRepository {
  public receivedInput?: CancelSaleInput;

  constructor(
    private readonly result: CancelSaleResult = {
      success: true,
    },
  ) {}

  async cancel(input: CancelSaleInput): Promise<CancelSaleResult> {
    this.receivedInput = input;

    return this.result;
  }
}

class FakeStockMovementRepository implements StockMovementRepository {
  public savedMovements: StockMovement[] = [];

  async listAll(): Promise<StockMovement[]> {
    return [];
  }

  async listByProductId(): Promise<StockMovement[]> {
    return [];
  }

  async save(movement: StockMovement): Promise<SaveStockMovementResult> {
    this.savedMovements.push(movement);

    return {
      movement,
      success: true,
    };
  }
}

class FailingStockMovementRepository extends FakeStockMovementRepository {
  async save(movement: StockMovement): Promise<SaveStockMovementResult> {
    this.savedMovements.push(movement);

    return {
      error: "unknown",
      success: false,
    };
  }
}

describe("cancelSaleUseCase", () => {
  it("cancels a completed sale and restores stock for every item", async () => {
    const saleCancellationRepository = new FakeSaleCancellationRepository();
    const saleDetailRepository = new FakeSaleDetailRepository({
      sale: createSaleDetail(),
      success: true,
    });
    const stockMovementRepository = new FakeStockMovementRepository();

    const result = await cancelSaleUseCase(" sale-1 ", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateStockMovementId: createSequentialIdGenerator(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository,
      saleDetailRepository,
      stockMovementRepository,
    });

    expect(result).toEqual({
      success: true,
    });
    expect(saleDetailRepository.receivedId).toBe("sale-1");
    expect(saleCancellationRepository.receivedInput).toEqual({
      canceledAt: new Date("2026-07-10T15:00:00.000Z"),
      saleId: "sale-1",
    });
    expect(stockMovementRepository.savedMovements).toEqual([
      {
        createdAt: new Date("2026-07-10T15:00:00.000Z"),
        id: "stock-movement-1",
        productId: "product-1",
        quantityChange: 2,
        saleId: "sale-1",
        type: "sale_cancellation",
      },
      {
        createdAt: new Date("2026-07-10T15:00:00.000Z"),
        id: "stock-movement-2",
        productId: "product-2",
        quantityChange: 1,
        saleId: "sale-1",
        type: "sale_cancellation",
      },
    ]);
  });

  it("rejects blank sale ids", async () => {
    const saleDetailRepository = new FakeSaleDetailRepository({
      error: "unknown",
      success: false,
    });
    const saleCancellationRepository = new FakeSaleCancellationRepository();

    const result = await cancelSaleUseCase(" ", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateStockMovementId: createSequentialIdGenerator(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository,
      saleDetailRepository,
      stockMovementRepository: new FakeStockMovementRepository(),
    });

    expect(result).toEqual({
      formError: "Venda nao encontrada.",
      success: false,
    });
    expect(saleDetailRepository.receivedId).toBeUndefined();
    expect(saleCancellationRepository.receivedInput).toBeUndefined();
  });

  it("requires an authenticated user", async () => {
    const result = await cancelSaleUseCase("sale-1", {
      currentUserProfileRepository: {
        getCurrent: async () => ({
          error: "unauthenticated",
          success: false,
        }),
      },
      generateStockMovementId: createSequentialIdGenerator(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository: new FakeSaleCancellationRepository(),
      saleDetailRepository: new FakeSaleDetailRepository({
        sale: createSaleDetail(),
        success: true,
      }),
      stockMovementRepository: new FakeStockMovementRepository(),
    });

    expect(result).toEqual({
      formError: "Sessao expirada. Entre novamente.",
      success: false,
    });
  });

  it("rejects missing sales", async () => {
    const result = await cancelSaleUseCase("sale-1", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateStockMovementId: createSequentialIdGenerator(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository: new FakeSaleCancellationRepository(),
      saleDetailRepository: new FakeSaleDetailRepository({
        error: "not_found",
        success: false,
      }),
      stockMovementRepository: new FakeStockMovementRepository(),
    });

    expect(result).toEqual({
      formError: "Venda nao encontrada.",
      success: false,
    });
  });

  it("rejects already canceled sales", async () => {
    const saleCancellationRepository = new FakeSaleCancellationRepository();
    const stockMovementRepository = new FakeStockMovementRepository();

    const result = await cancelSaleUseCase("sale-1", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateStockMovementId: createSequentialIdGenerator(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository,
      saleDetailRepository: new FakeSaleDetailRepository({
        sale: {
          ...createSaleDetail(),
          status: "canceled",
        },
        success: true,
      }),
      stockMovementRepository,
    });

    expect(result).toEqual({
      formError: "Venda ja cancelada.",
      success: false,
    });
    expect(saleCancellationRepository.receivedInput).toBeUndefined();
    expect(stockMovementRepository.savedMovements).toEqual([]);
  });

  it("returns an error when sale cancellation cannot be persisted", async () => {
    const stockMovementRepository = new FakeStockMovementRepository();

    const result = await cancelSaleUseCase("sale-1", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateStockMovementId: createSequentialIdGenerator(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository: new FakeSaleCancellationRepository({
        error: "unknown",
        success: false,
      }),
      saleDetailRepository: new FakeSaleDetailRepository({
        sale: createSaleDetail(),
        success: true,
      }),
      stockMovementRepository,
    });

    expect(result).toEqual({
      formError: "Nao foi possivel cancelar a venda.",
      success: false,
    });
    expect(stockMovementRepository.savedMovements).toEqual([]);
  });

  it("returns an error when stock restoration cannot be saved", async () => {
    const result = await cancelSaleUseCase("sale-1", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateStockMovementId: createSequentialIdGenerator(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository: new FakeSaleCancellationRepository(),
      saleDetailRepository: new FakeSaleDetailRepository({
        sale: createSaleDetail(),
        success: true,
      }),
      stockMovementRepository: new FailingStockMovementRepository(),
    });

    expect(result).toEqual({
      formError: "Nao foi possivel devolver o estoque da venda.",
      success: false,
    });
  });
});

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

function createSaleDetail(): SaleDetail {
  return {
    cashSessionId: "cash-session-1",
    completedAt: new Date("2026-07-10T12:00:00.000Z"),
    eventId: "event-1",
    eventName: "Evento Julho",
    id: "sale-1",
    items: [
      {
        productId: "product-1",
        productName: "Chaveiro Polvo",
        quantity: 2,
        totalInReais: 30,
        unitPriceInReais: 15,
      },
      {
        productId: "product-2",
        productName: "Caneca",
        quantity: 1,
        totalInReais: 25,
        unitPriceInReais: 25,
      },
    ],
    payment: {
      amountInReais: 60,
      changeInReais: 5,
      method: "cash",
    },
    status: "completed",
    totalInReais: 55,
  };
}

function createSequentialIdGenerator(): () => string {
  let index = 0;

  return () => {
    index += 1;

    return `stock-movement-${index}`;
  };
}
