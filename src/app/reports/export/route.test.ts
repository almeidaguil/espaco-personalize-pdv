import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock(
  "@/modules/reports/infra/supabase-sales-by-event-report-repository",
  () => ({
    SupabaseSalesByEventReportRepository: vi.fn(),
  }),
);

const getSalesByEventReportUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@/modules/reports/application/get-sales-by-event-report-use-case",
  () => ({
    getSalesByEventReportUseCase: getSalesByEventReportUseCaseMock,
  }),
);

describe("GET /reports/export", () => {
  it("returns a CSV file for the selected event", async () => {
    getSalesByEventReportUseCaseMock.mockResolvedValueOnce({
      report: {
        canceledSalesCount: 0,
        canceledTotalInReais: 0,
        completedSalesCount: 1,
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "Evento Julho",
        grossTotalInReais: 30,
        items: [
          {
            grossTotalInReais: 30,
            productId: "product-1",
            productName: "Chaveiro Polvo",
            quantity: 2,
          },
        ],
        paymentSummary: [
          {
            method: "cash",
            netTotalInReais: 30,
            salesCount: 1,
          },
        ],
      },
      success: true,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/reports/export?eventId=11111111-1111-4111-8111-111111111111",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      "relatorio-evento-julho.csv",
    );
    expect(await response.text()).toContain("Resumo;Vendas concluidas;1;30,00");
  });
});
