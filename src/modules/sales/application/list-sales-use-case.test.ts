import { describe, expect, it } from "vitest";

import { listSalesUseCase } from "./list-sales-use-case";
import type {
  ListSaleSummariesResult,
  SaleSummaryRepository,
} from "./sale-summary-repository";

class FakeSaleSummaryRepository implements SaleSummaryRepository {
  constructor(private readonly result: ListSaleSummariesResult) {}

  async list(): Promise<ListSaleSummariesResult> {
    return this.result;
  }
}

describe("listSalesUseCase", () => {
  it("lists sale summaries", async () => {
    const result = {
      sales: [
        {
          cashSessionId: "cash-session-1",
          completedAt: new Date("2026-07-10T12:00:00.000Z"),
          eventId: "event-1",
          eventName: "Evento Julho",
          id: "sale-1",
          status: "completed" as const,
          totalInReais: 30,
        },
      ],
      success: true as const,
    };

    await expect(
      listSalesUseCase({
        saleSummaryRepository: new FakeSaleSummaryRepository(result),
      }),
    ).resolves.toEqual(result);
  });
});
