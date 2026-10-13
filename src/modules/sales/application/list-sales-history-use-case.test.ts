import { describe, expect, it, vi } from "vitest";
import { listSalesHistoryUseCase } from "./list-sales-history-use-case";

const repository = () => ({
  listPage: vi.fn(async () => ({
    success: true as const,
    sales: [],
    totalCount: 0,
    page: 1,
    pageSize: 8,
  })),
  listFilterOptions: vi.fn(async () => ({
    success: true as const,
    options: { operators: [], sessions: [] },
  })),
});

describe("listSalesHistoryUseCase", () => {
  it.each([
    { startDate: "2026-02-30" },
    { endDate: "tomorrow" },
    { startDate: "2026-07-31", endDate: "2026-07-01" },
    { operatorId: "not-a-uuid" },
    { cashSessionId: "not-a-uuid" },
    { page: 0 },
    { page: 1.5 },
    { pageSize: 201 },
    { status: "other" },
  ])("rejects invalid filters before querying: %j", async (filters) => {
    const salesHistoryRepository = repository();
    const result = await listSalesHistoryUseCase({
      filters,
      salesHistoryRepository,
    });
    expect(result).toMatchObject({
      success: false,
      error: "invalid_filters",
      formError: expect.any(String),
    });
    expect(salesHistoryRepository.listPage).not.toHaveBeenCalled();
    expect(salesHistoryRepository.listFilterOptions).not.toHaveBeenCalled();
  });
  it("normalizes empty query fields and preserves pagination", async () => {
    const salesHistoryRepository = repository();
    const result = await listSalesHistoryUseCase({
      filters: { operatorId: "", startDate: "", status: "", page: "2" },
      salesHistoryRepository,
    });
    expect(result).toMatchObject({
      success: true,
      options: { operators: [], sessions: [] },
    });
    expect(salesHistoryRepository.listPage).toHaveBeenCalledWith({
      operatorId: undefined,
      startDate: undefined,
      status: undefined,
      page: 2,
      pageSize: 8,
    });
  });
});
