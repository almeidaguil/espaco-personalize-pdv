import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSalesReportFixture } from "@/modules/reports/testing/sales-report-fixture";

import { GET } from "./route";

const getUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));
vi.mock("@/modules/reports/infra/supabase-sales-report-repository", () => ({
  SupabaseSalesReportRepository: vi.fn(),
}));

const getCompleteSalesReportUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@/modules/reports/application/get-complete-sales-report-use-case",
  () => ({
    getCompleteSalesReportUseCase: getCompleteSalesReportUseCaseMock,
  }),
);

describe("GET /reports/export", () => {
  beforeEach(() => {
    getCompleteSalesReportUseCaseMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
      error: null,
    });
  });

  it("returns a private CSV generated from the same report filters", async () => {
    getCompleteSalesReportUseCaseMock.mockResolvedValueOnce({
      report: createSalesReportFixture({ endDate: "2026-10-03" }),
      success: true,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/reports/export?startDate=2026-10-02&endDate=2026-10-03&operatorId=11111111-1111-4111-8111-111111111111&cashSessionId=22222222-2222-4222-8222-222222222222",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain(
      "relatorio-vendas-2026-10-02-a-2026-10-03.csv",
    );
    expect(await response.text()).toContain(
      "Resumo;vendas_concluidas;Vendas concluídas;2;45,00",
    );
    expect(getCompleteSalesReportUseCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          cashSessionId: "22222222-2222-4222-8222-222222222222",
          endDate: "2026-10-03",
          operatorId: "11111111-1111-4111-8111-111111111111",
          startDate: "2026-10-02",
        },
      }),
    );
  });

  it("returns 401 without an authenticated user", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid session" },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/reports/export?startDate=2026-10-02&endDate=2026-10-02",
      ),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getCompleteSalesReportUseCaseMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the operator requests another seller", async () => {
    getCompleteSalesReportUseCaseMock.mockResolvedValueOnce({
      error: "forbidden",
      success: false,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/reports/export?startDate=2026-10-02&endDate=2026-10-02&operatorId=99999999-9999-4999-8999-999999999999",
      ),
    );

    expect(response.status).toBe(403);
  });

  it("returns 401 when the report RPC rejects an inactive session", async () => {
    getCompleteSalesReportUseCaseMock.mockResolvedValueOnce({
      error: "unauthorized",
      success: false,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/reports/export?startDate=2026-10-02&endDate=2026-10-02",
      ),
    );

    expect(response.status).toBe(401);
  });

  it("returns 500 for an unexpected database failure", async () => {
    getCompleteSalesReportUseCaseMock.mockResolvedValueOnce({
      error: "unknown",
      success: false,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/reports/export?startDate=2026-10-02&endDate=2026-10-02",
      ),
    );

    expect(response.status).toBe(500);
  });
});
