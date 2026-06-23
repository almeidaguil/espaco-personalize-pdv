import { describe, expect, it, vi } from "vitest";

import { getSalesByEventReportUseCase } from "./get-sales-by-event-report-use-case";
import type { SalesByEventReportRepository } from "./sales-by-event-report-repository";

describe("getSalesByEventReportUseCase", () => {
  it("returns the event sales report", async () => {
    const repository: SalesByEventReportRepository = {
      getByEventId: vi.fn(async () => ({
        report: {
          canceledSalesCount: 1,
          canceledTotalInReais: 15,
          completedSalesCount: 2,
          eventId: "11111111-1111-4111-8111-111111111111",
          eventName: "Evento Julho",
          grossTotalInReais: 45,
          items: [],
          paymentSummary: [],
        },
        success: true as const,
      })),
    };

    const result = await getSalesByEventReportUseCase({
      eventId: "11111111-1111-4111-8111-111111111111",
      salesByEventReportRepository: repository,
    });

    expect(result).toMatchObject({
      report: {
        eventName: "Evento Julho",
        grossTotalInReais: 45,
      },
      success: true,
    });
    expect(repository.getByEventId).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("rejects invalid event ids before querying the repository", async () => {
    const repository: SalesByEventReportRepository = {
      getByEventId: vi.fn(async () => ({
        error: "unknown" as const,
        success: false as const,
      })),
    };

    const result = await getSalesByEventReportUseCase({
      eventId: "invalid-event",
      salesByEventReportRepository: repository,
    });

    expect(result).toEqual({
      formError: "Selecione um evento valido para gerar o relatorio.",
      success: false,
    });
    expect(repository.getByEventId).not.toHaveBeenCalled();
  });
});
