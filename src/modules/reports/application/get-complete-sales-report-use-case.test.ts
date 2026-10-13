import { describe, expect, it, vi } from "vitest";

import { createSalesReportFixture } from "../testing/sales-report-fixture";
import { getCompleteSalesReportUseCase } from "./get-complete-sales-report-use-case";
import type { SalesReportRepository } from "./sales-report-repository";

describe("getCompleteSalesReportUseCase", () => {
  it("requests the complete bounded export in a single database snapshot", async () => {
    const report = createSalesReportFixture();
    const get = vi.fn(async () => ({ report, success: true as const }));
    const repository: SalesReportRepository = { get };

    const result = await getCompleteSalesReportUseCase({
      filters: { endDate: "2026-10-02", startDate: "2026-10-02" },
      salesReportRepository: repository,
    });

    expect(result).toEqual({ report, success: true });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith({
      endDate: "2026-10-02",
      exportMode: true,
      itemsPage: 1,
      pageSize: 10_000,
      sessionsPage: 1,
      startDate: "2026-10-02",
    });
  });

  it("rejects a truncated export instead of producing a partial CSV", async () => {
    const repository: SalesReportRepository = {
      get: vi.fn(async () => ({
        report: createSalesReportFixture({ itemsTotalCount: 2 }),
        success: true as const,
      })),
    };

    await expect(
      getCompleteSalesReportUseCase({
        filters: { endDate: "2026-10-02", startDate: "2026-10-02" },
        salesReportRepository: repository,
      }),
    ).resolves.toEqual({ error: "unknown", success: false });
  });
});
