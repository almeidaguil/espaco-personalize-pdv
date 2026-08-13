import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  CancelSaleInput,
  CancelSaleResult,
  SaleCancellationRepository,
} from "../application/sale-cancellation-repository";
import type {
  GetSaleDetailResult,
  SaleDetail,
  SaleDetailRepository,
} from "../application/sale-detail-repository";
import { cancelSaleActionService } from "./cancel-sale-action-service";

class FakeSaleDetailRepository implements SaleDetailRepository {
  constructor(
    private readonly result: GetSaleDetailResult = {
      sale: createSaleDetail(),
      success: true,
    },
  ) {}

  async findById(): Promise<GetSaleDetailResult> {
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

describe("cancelSaleActionService", () => {
  it("cancels a sale from form data", async () => {
    const saleCancellationRepository = new FakeSaleCancellationRepository();

    const result = await cancelSaleActionService(
      {},
      createFormData("sale-1", true),
      {
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
        saleCancellationRepository,
        saleDetailRepository: new FakeSaleDetailRepository(),
      },
    );

    expect(result).toEqual({
      successMessage: "Venda cancelada com sucesso.",
    });
    expect(saleCancellationRepository.receivedInput).toEqual({
      adminPassword: "admin-password-test",
      canceledAt: new Date("2026-07-10T15:00:00.000Z"),
      saleId: "sale-1",
    });
  });

  it("requires cancellation confirmation", async () => {
    const result = await cancelSaleActionService(
      {},
      createFormData("sale-1", false),
      {
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
        saleCancellationRepository: new FakeSaleCancellationRepository(),
        saleDetailRepository: new FakeSaleDetailRepository(),
      },
    );

    expect(result).toEqual({
      formError: "Confirme o cancelamento antes de continuar.",
    });
  });

  it("returns use case errors", async () => {
    const result = await cancelSaleActionService({}, createFormData("", true), {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
      saleCancellationRepository: new FakeSaleCancellationRepository(),
      saleDetailRepository: new FakeSaleDetailRepository(),
    });

    expect(result).toEqual({
      formError: "Venda nao encontrada.",
    });
  });

  it("keeps cancellation failure messages", async () => {
    const result = await cancelSaleActionService(
      {},
      createFormData("sale-1", true),
      {
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T15:00:00.000Z"),
        saleCancellationRepository: new FakeSaleCancellationRepository({
          error: "unknown",
          success: false,
        }),
        saleDetailRepository: new FakeSaleDetailRepository(),
      },
    );

    expect(result).toEqual({
      formError: "Nao foi possivel cancelar a venda.",
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
    ],
    payment: {
      amountInReais: 50,
      changeInReais: 20,
      method: "cash",
    },
    status: "completed",
    totalInReais: 30,
  };
}

function createFormData(
  saleId: string,
  confirmCancellation: boolean,
): FormData {
  const formData = new FormData();
  formData.set("adminPassword", "admin-password-test");
  formData.set("saleId", saleId);
  if (confirmCancellation) {
    formData.set("confirmCancellation", "on");
  }

  return formData;
}
