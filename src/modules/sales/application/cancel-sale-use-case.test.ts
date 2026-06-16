import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

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

describe("cancelSaleUseCase", () => {
  it("cancels a completed sale and restores stock for every item", async () => {
    const saleCancellationRepository = new FakeSaleCancellationRepository();
    const saleDetailRepository = new FakeSaleDetailRepository({
      sale: createSaleDetail(),
      success: true,
    });

    const result = await cancelSaleUseCase(
      {
        adminPassword: "123456",
        saleId: " sale-1 ",
      },
      {
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
        saleCancellationRepository,
        saleDetailRepository,
      },
    );

    expect(result).toEqual({
      success: true,
    });
    expect(saleDetailRepository.receivedId).toBe("sale-1");
    expect(saleCancellationRepository.receivedInput).toEqual({
      adminPassword: "123456",
      canceledAt: new Date("2026-07-10T15:00:00.000Z"),
      saleId: "sale-1",
    });
  });

  it("rejects blank sale ids", async () => {
    const saleDetailRepository = new FakeSaleDetailRepository({
      error: "unknown",
      success: false,
    });
    const saleCancellationRepository = new FakeSaleCancellationRepository();

    const result = await cancelSaleUseCase(" ", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository,
      saleDetailRepository,
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
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository: new FakeSaleCancellationRepository(),
      saleDetailRepository: new FakeSaleDetailRepository({
        sale: createSaleDetail(),
        success: true,
      }),
    });

    expect(result).toEqual({
      formError: "Sessao expirada. Entre novamente.",
      success: false,
    });
  });

  it("rejects missing sales", async () => {
    const result = await cancelSaleUseCase("sale-1", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository: new FakeSaleCancellationRepository(),
      saleDetailRepository: new FakeSaleDetailRepository({
        error: "not_found",
        success: false,
      }),
    });

    expect(result).toEqual({
      formError: "Venda nao encontrada.",
      success: false,
    });
  });

  it("rejects already canceled sales", async () => {
    const saleCancellationRepository = new FakeSaleCancellationRepository();

    const result = await cancelSaleUseCase("sale-1", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository,
      saleDetailRepository: new FakeSaleDetailRepository({
        sale: {
          ...createSaleDetail(),
          status: "canceled",
        },
        success: true,
      }),
    });

    expect(result).toEqual({
      formError: "Venda ja cancelada.",
      success: false,
    });
    expect(saleCancellationRepository.receivedInput).toBeUndefined();
  });

  it("returns an error when sale cancellation cannot be persisted", async () => {
    const result = await cancelSaleUseCase("sale-1", {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository: new FakeSaleCancellationRepository({
        error: "unknown",
        success: false,
      }),
      saleDetailRepository: new FakeSaleDetailRepository({
        sale: createSaleDetail(),
        success: true,
      }),
    });

    expect(result).toEqual({
      formError: "Nao foi possivel cancelar a venda.",
      success: false,
    });
  });

  it("maps admin password failures to a form error", async () => {
    const result = await cancelSaleUseCase(
      {
        saleId: "sale-1",
      },
      {
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
        saleCancellationRepository: new FakeSaleCancellationRepository({
          error: "admin_password_required",
          success: false,
        }),
        saleDetailRepository: new FakeSaleDetailRepository({
          sale: createSaleDetail(),
          success: true,
        }),
      },
    );

    expect(result).toEqual({
      formError: "Informe a senha administrativa para cancelar a venda.",
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
