import { describe, expect, it, vi } from "vitest";

import { createSalesReportFixture } from "../testing/sales-report-fixture";
import { getSalesReportUseCase } from "./get-sales-report-use-case";
import type { SalesReportRepository } from "./sales-report-repository";

describe("getSalesReportUseCase", () => {
  it("normalizes and sends a valid period and optional filters to the repository", async () => {
    const repository: SalesReportRepository = {
      get: vi.fn(async () => ({
        report: createSalesReportFixture(),
        success: true as const,
      })),
    };
    const filters = {
      cashSessionId: "22222222-2222-4222-8222-222222222222",
      endDate: "2026-10-03",
      operatorId: "11111111-1111-4111-8111-111111111111",
      startDate: "2026-10-02",
    };

    const result = await getSalesReportUseCase({
      filters,
      salesReportRepository: repository,
    });

    expect(result.success).toBe(true);
    expect(repository.get).toHaveBeenCalledWith({
      ...filters,
      exportMode: false,
      itemsPage: 1,
      pageSize: 8,
      sessionsPage: 1,
    });
  });

  it.each([
    [
      { startDate: "invalid", endDate: "2026-10-02" },
      "Informe uma data válida.",
    ],
    [
      { startDate: "2026-10-03", endDate: "2026-10-02" },
      "A data final deve ser igual ou posterior à data inicial.",
    ],
    [
      {
        startDate: "2025-01-01",
        endDate: "2026-10-02",
      },
      "O período máximo permitido é de 366 dias.",
    ],
    [
      {
        startDate: "2026-10-02",
        endDate: "2026-10-02",
        operatorId: "invalid",
      },
      "Informe um identificador válido.",
    ],
  ])(
    "rejects invalid filters before querying the repository",
    async (filters, error) => {
      const repository: SalesReportRepository = {
        get: vi.fn(async () => ({
          error: "unknown" as const,
          success: false as const,
        })),
      };

      const result = await getSalesReportUseCase({
        filters: filters as never,
        salesReportRepository: repository,
      });

      expect(result).toMatchObject({ formError: error, success: false });
      expect(repository.get).not.toHaveBeenCalled();
    },
  );
});
