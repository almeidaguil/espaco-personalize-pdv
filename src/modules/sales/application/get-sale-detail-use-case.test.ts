import { describe, expect, it } from "vitest";

import { getSaleDetailUseCase } from "./get-sale-detail-use-case";
import type {
  GetSaleDetailResult,
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

describe("getSaleDetailUseCase", () => {
  it("gets sale details by id", async () => {
    const repository = new FakeSaleDetailRepository({
      sale: {
        cashSessionId: "cash-session-1",
        completedAt: new Date("2026-07-10T12:00:00.000Z"),
        eventId: "event-1",
        eventName: "Evento Julho",
        id: "sale-1",
        items: [],
        payment: {
          amountInReais: 50,
          changeInReais: 20,
          method: "cash",
        },
        status: "completed",
        totalInReais: 30,
      },
      success: true,
    });

    await expect(
      getSaleDetailUseCase(" sale-1 ", {
        saleDetailRepository: repository,
      }),
    ).resolves.toMatchObject({
      success: true,
    });
    expect(repository.receivedId).toBe("sale-1");
  });

  it("rejects blank ids", async () => {
    const repository = new FakeSaleDetailRepository({
      error: "unknown",
      success: false,
    });

    await expect(
      getSaleDetailUseCase(" ", {
        saleDetailRepository: repository,
      }),
    ).resolves.toEqual({
      error: "not_found",
      success: false,
    });
    expect(repository.receivedId).toBeUndefined();
  });
});
